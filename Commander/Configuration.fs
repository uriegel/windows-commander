module Configuration

open FSharpRailway
open Railway
open FSharpTools
open FSharpTools.Functional
open System
open System.Text.Encodings.Web;
open System.Text.Json
open System.Text.Json.Serialization

open FileSystem
open PlatformConfiguration

let retrieveConfigDirectory = Directory.retrieveConfigDirectory "uriegel.de"
let getConfigDirectory = memoize retrieveConfigDirectory

type WindowBounds = {
    X:           int option
    Y:           int option
    Width:       int
    Height:      int
    IsMaximized: bool option
    Icon:        string option
    Theme:       string option
    Frame:       bool option
}

let getJsonOptions = 
    let getJsonOptions () = 
        let jsonOptions = JsonSerializerOptions()
        jsonOptions.PropertyNamingPolicy <- JsonNamingPolicy.CamelCase
        jsonOptions.Encoder <- JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        jsonOptions.DefaultIgnoreCondition <- JsonIgnoreCondition.WhenWritingNull
        jsonOptions.Converters.Add(JsonFSharpConverter())
        jsonOptions
    memoizeSingle getJsonOptions

let getElectronFile file = 
    [| 
        getConfigDirectory "commander"
        "electron"
        file
    |] |> Directory.combinePathes 
    
let copyStream (target: IO.Stream, source: IO.Stream) = 
    source.CopyTo target
    source.Flush ()
    target.Close ()
    Threading.Thread.Sleep 2000

let getResource resourcePath = 
    let assembly = Reflection.Assembly.GetEntryAssembly ()
    assembly.GetManifestResourceStream resourcePath

let getFileAndResourceStreams (getFileStream: string->IO.Stream) (getResourceStream: string->IO.Stream) (filePath, resourcePath) =
    (getFileStream filePath, getResourceStream resourcePath)

let saveResource = 
    let saveResource = 
        tee (getFileAndResourceStreams securedCreateStream getResource >> copyStream) >> takeFirstTupleElem
    memoize saveResource 

let saveBounds (bounds: WindowBounds) = 
    use stream = securedCreateStream <| getElectronFile "bounds.json"
    JsonSerializer.Serialize (stream, bounds, getJsonOptions ())

let getBounds theme = 
    let filename = getElectronFile "bounds.json"
    if IO.File.Exists filename then
        use stream = securedOpenStream <| getElectronFile "bounds.json"
        { 
            JsonSerializer.Deserialize<WindowBounds> (stream, getJsonOptions ())     
                with 
                    Icon  = Some <| saveResource (getElectronFile "appicon.ico", "web/images/appicon")
                    Theme = Some theme
                    Frame = Some (getPlatform <> Platform.Windows)
        }
    else {
            X           = None
            Y           = None
            Width       = 600
            Height      = 800
            IsMaximized = Some false
            Icon        = Some <| saveResource (getElectronFile "appicon.ico", "web/images/appicon")
            Theme       = Some theme
            Frame       = Some (getPlatform <> Platform.Windows)
        }
        