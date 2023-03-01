module Routes 

open Giraffe
open GiraffeTools
open Microsoft.AspNetCore.Builder
open Microsoft.AspNetCore.Cors
open Microsoft.AspNetCore.Http
open Microsoft.Extensions.Logging
open System
open System.Text.Json

open Configuration
open FileSystem
open Directory
open Root
open System.Reactive.Subjects
open MainEvents
open FSharpTools.Directory

let configureCors (builder: Infrastructure.CorsPolicyBuilder) =
    builder
        .WithOrigins("http://localhost:3000")
        .AllowAnyHeader()
        .AllowAnyMethod() 
        |> ignore

let getExtendedItems () =
    fun (next : HttpFunc) (ctx : HttpContext) ->
        task {
            let! body = ctx.ReadBodyFromRequestAsync ()
            let param = JsonSerializer.Deserialize<GetExtendedItems>(body, getJsonOptions ())
            let! result = Directory.getExtendedItems param
            return! Json.text result next ctx
        }

type RendererEvent = 
    | ThemeChanged of string
    // | ElectronMaximize 
    // | ElectronUnmaximize 
    // | Fullscreen of bool
    // | RenameRemote of RenameRemote
    // | DeleteRemotes of string[]
    | Nothing


let rendererReplaySubject: Subject<RendererEvent> = new Subject<RendererEvent>()        

let startThemeDetection () = 
    let onChanged theme = 
        rendererReplaySubject.OnNext <| ThemeChanged theme
        mainReplaySubject.OnNext <| Theme theme
    Theme.startThemeDetection onChanged

let configure (app : IApplicationBuilder) = 
    let getMimeType path = 
        match getExtension path with
        | Some ".js"  -> "text/javascript"
        | Some ".css" -> "text/css"
        | _           -> "text/plain"
        
    let getResourceFile path = 
        setContentType <| getMimeType path     >=> streamData false (getResource <| sprintf "web/%s" path) None None

    let getRoot () =
        fun (next : HttpFunc) (ctx : HttpContext) ->
            task {
                let! body = ctx.ReadBodyFromRequestAsync ()
                let! result = getRoot ()
                return! Json.text result next ctx
            }

    let sendBounds (windowBounds: WindowBounds) = 

        let saveBounds (bounds: WindowBounds) = 
            use stream = securedCreateStream <| getElectronFile "bounds.json"
            JsonSerializer.Serialize (stream, bounds, getJsonOptions ())

        saveBounds windowBounds
        text "{}"

    let renameItem () = 
        fun (next : HttpFunc) (ctx : HttpContext) ->
            task {
                let! body = ctx.ReadBodyFromRequestAsync ()
                let param = JsonSerializer.Deserialize<RenameItemParam>(body, getJsonOptions ())
                let result = renameItem param
                return! Json.text result next ctx
            }        

    let createFolder () = 
        fun (next : HttpFunc) (ctx : HttpContext) ->
            task {
                let! body = ctx.ReadBodyFromRequestAsync ()
                let param = JsonSerializer.Deserialize<CreateFolderParam>(body, getJsonOptions ())
                let result = createFolder [|param.Path; param.Name|]
                return! Json.text result next ctx
            }        

    let deleteItems () = 
        fun (next : HttpFunc) (ctx : HttpContext) ->
            task {
                let! body = ctx.ReadBodyFromRequestAsync ()
                let param = JsonSerializer.Deserialize<DeleteItemsParam>(body, getJsonOptions ())
                let result = 
                    param.Names
                    |> Array.map (fun n -> combine2Pathes param.Path n)
                    |> deleteItems
                return! Json.text result next ctx
            }        

    let sse () = Sse.create rendererReplaySubject <| getJsonOptions ()

    let routes =
        choose [  
            route  "/commander/getfiles"         >=> warbler (fun _ -> Directory.getFiles ())
            route  "/commander/getroot"          >=> warbler (fun _ -> getRoot ())
            route  "/commander/geticon"          >=> bindQuery<FileRequest> None getIconRequest
            route  "/commander/image"            >=> bindQuery<FileRequest> None getImage
            route  "/commander/file"            >=> bindQuery<FileRequest> None getFile
            route  "/commander/movie"            >=> bindQuery<FileRequest> None getMovie
            route  "/commander/getextendeditems" >=> warbler (fun _ -> getExtendedItems ())
            route  "/commander/showdevtools"     >=> warbler (fun _ -> showDevTools ())
            route  "/commander/showfullscreen"   >=> warbler (fun _ -> showFullscreen ())
            route  "/commander/getevents"        >=> warbler (fun _ -> getEvents ())
            route  "/commander/sse"              >=> warbler (fun _ -> sse ())
            route  "/commander/sendbounds"       >=> bindJson<WindowBounds> sendBounds
            route  "/commander/renameitem"       >=> warbler (fun _ -> renameItem ())
            route  "/commander/createfolder"     >=> warbler (fun _ -> createFolder ())
            route  "/commander/deleteitems"      >=> warbler (fun _ -> deleteItems ())
            routef "/static/js/%s" (fun _ -> httpHandlerParam getResourceFile "scripts/script.js")
            routef "/static/css/%s" (fun _ -> httpHandlerParam getResourceFile "styles/style.css")
            route  "/"                           >=> warbler (fun _ -> streamData false (getResource "web/index.html") None None)
            routePathes () <| httpHandlerParam getResourceFile 
        ]       
    app
        .UseResponseCompression()
        .UseCors(configureCors)
        .UseGiraffe routes      
     
