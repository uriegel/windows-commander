module Utils

open FSharpRailway.Option
open FSharpTools
open Microsoft.AspNetCore.Http
open System
open System.Text.Json
open System.Threading.Tasks

let tee f x = 
    f x
    x

let memoizeSingle funToMemoize =
    let memoized = funToMemoize ()
    (fun () -> memoized)

let takeFirstTupleElem (a, _) = a

let combine2Pathes path1 path2 = IO.Path.Combine (path1, path2)
let combine3Pathes path1 path2 path3 = IO.Path.Combine (path1, path2, path3)
let createStream path : IO.Stream = IO.File.Create path
let openStream path : IO.Stream = IO.File.OpenRead path

let checkDirectory path = 
    let info = IO.FileInfo path
    if not info.Directory.Exists then 
        IO.Directory.CreateDirectory info.DirectoryName |> ignore
    path

let securedCreateStream = checkDirectory >> createStream
let securedOpenStream = checkDirectory >> openStream

let getExtension file =
    let getExtensionIndex () = file |> String.lastIndexOfChar '.'
    let getExtensionFromIndex index = Some (file |> String.substring index)
    let getExtension = getExtensionIndex >=> getExtensionFromIndex
    getExtension ()

open Giraffe

// TODO Giraffe Utils
let httpHandlerParam httpHandler param: HttpHandler = (fun () -> httpHandler(param))()
let routePathes () (routeHandler : string -> HttpHandler) : HttpHandler =
    fun (next : HttpFunc) (ctx : HttpContext) ->
        Some (SubRouting.getNextPartOfPath ctx)
        |> function
            | Some subpath -> routeHandler subpath[1..] next ctx    
            | None         -> skipPipeline

let createSse<'a> (observable: IObservable<'a>) (jsonOptions: JsonSerializerOptions) =  
    fun (next : HttpFunc) (ctx : HttpContext) ->
        task {
            let res = ctx.Response
            ctx.SetStatusCode 200
            ctx.SetHttpHeader("Content-Type", "text/event-stream")
            ctx.SetHttpHeader("Cache-Control", "no-cache")
            while true do
                let tcs = TaskCompletionSource<'a>()
                use subscription = observable.Subscribe (fun evt -> tcs.SetResult(evt))
                let! evt = tcs.Task
                let payload = JsonSerializer.Serialize(evt, jsonOptions)
                do! res.WriteAsync $"data:{payload}\n\n"
                do! res.Body.FlushAsync()

            // This won't be hit because we're expecting
            // the browser to break the connection
            // although you can indeed break from the loop above and get here
            return! text "" next ctx
        }        