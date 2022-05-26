module Directory

open ClrWinApi
open FSharpTools
open System
open System.Diagnostics
open System.Drawing
open System.Drawing.Imaging
open System.IO
open System.Reactive.Subjects
open System.Runtime.InteropServices

open Directory
open Engine
open FileSystem
open Model

let extendColumns columns = 
    Array.concat [ columns; [| { Name = "Version";  Column = "version"; Type = ColumnsType.Version } |] ]

let getIconPath (fileInfo: FileInfo) = 
    match fileInfo.Extension with
    | ext when ext |> String.toLower = ".exe" -> fileInfo.FullName
    | ext when ext |> String.length > 0       -> ext
    | _                                       -> ".noextension"

let getIcon ext = async {
    let rec getIconHandle callCount = async {
        if ext |> String.contains "\\" then
            return Icon.ExtractAssociatedIcon(ext).Handle
        else
            let mutable shinfo = ShFileInfo()
            SHGetFileInfo(ext, FileAttributeNormal, &shinfo, Marshal.SizeOf shinfo,
                SHGetFileInfoConstants.ICON
                ||| SHGetFileInfoConstants.SMALLICON
                ||| SHGetFileInfoConstants.USEFILEATTRIBUTES
                ||| SHGetFileInfoConstants.TYPENAME) |> ignore

            if shinfo.IconHandle <> IntPtr.Zero then
                return shinfo.IconHandle
            elif callCount < 3 then
                do! Async.Sleep 29
                return! getIconHandle <| callCount + 1
            else
                return Icon.ExtractAssociatedIcon(@"C:\Windows\system32\SHELL32.dll").Handle
    }

    let! iconHandle = getIconHandle 0
    use icon = Icon.FromHandle iconHandle
    use bitmap = icon.ToBitmap()
    let ms = new MemoryStream()
    bitmap.Save(ms, ImageFormat.Png)
    ms.Position <- 0L
    DestroyIcon iconHandle |> ignore
    return ms
}

let appendPlatformInfo (subj: Subject<FolderEvent>) requestId id (path: string) (items: DirectoryItem seq) = 

    let filterEnhanced item = 
        (  item.Name |> String.endsWithComparison "exe" StringComparison.OrdinalIgnoreCase
        || item.Name |> String.endsWithComparison "dll" StringComparison.OrdinalIgnoreCase)
        && requestId.Id = id

    let addVersion (item: DirectoryItem) = 

        let mapVersion (info: FileVersionInfo) = { 
            Index = item.Index
            ExifTime = None 
            Version = Some {
                Major = info.FileMajorPart
                Minor = info.FileMinorPart
                Patch = info.FilePrivatePart
                Build = info.FileBuildPart
        }}

        if requestId.Id = id then
            Option.ofObj (FileVersionInfo.GetVersionInfo <| Path.Combine(path, item.Name))
            |> Option.map(mapVersion)
        else 
            None

    let versionItems = 
        items
        |> Seq.filter filterEnhanced
        |> Seq.choose addVersion
        |> Seq.toArray
    
    if requestId.Id = id && versionItems.Length > 0 then
        subj.OnNext <| EnhancedInfo versionItems

let deleteItems items = 

    let append toAppend str =  str + toAppend

    let input = 
         items 
        |> String.joinStr "\U00000000"
        |> append "\U00000000\U00000000"

    let flags = 
        FileOpFlags.NOCONFIRMATION 
        ||| FileOpFlags.NOERRORUI
        ||| FileOpFlags.NOCONFIRMMKDIR
        ||| FileOpFlags.SILENT
        ||| FileOpFlags.ALLOWUNDO

    let mutable fileOperation = SHFILEOPSTRUCT() 
    fileOperation.Func                  <- FileFuncFlags.DELETE
    fileOperation.From                  <- input
    fileOperation.Flags                 <- flags
    
    let res = SHFileOperation fileOperation 
    match res with
    | 0     -> None
    | 2     -> Some FileNotFound
    | 0x78  -> Some AccessDenied
    | _     -> Some (Exception "Löschen fehlgeschlagen")
    |> getError
    |> serializeToJson

let getCopyConflicts items sourcePath targetPath =

    let getFileSystemType path = 
        if existsFile path then
            FileSystemType.File
        else if existsDirectory path then
            FileSystemType.Directory
        else
            FileSystemType.None

    let getInfo item = 
        let sourcePath = combine2Pathes sourcePath item 
        let targetPath = combine2Pathes targetPath item 
        
        match getFileSystemType targetPath with 
            | FileSystemType.File -> 
                let sourceInfo = FileInfo sourcePath
                let targetInfo = FileInfo targetPath
                Some {
                    Conflict   =  item
                    IsDirectory = false
                    IconPath   =  Some <| getIconPath sourceInfo
                    SourceTime =  sourceInfo.LastWriteTime
                    SourceSize =  sourceInfo.Length
                    TargetTime =  targetInfo.LastWriteTime
                    TargetSize =  targetInfo.Length
                }
            | FileSystemType.Directory -> 
                let sourceInfo = DirectoryInfo sourcePath
                let targetInfo = DirectoryInfo targetPath
                Some {
                    Conflict =    item
                    IsDirectory = true
                    IconPath =    None
                    SourceTime =  sourceInfo.LastWriteTime
                    SourceSize =  0
                    TargetTime =  targetInfo.LastWriteTime
                    TargetSize =  0
                }
            | _ -> None        

    items 
    |> Seq.choose getInfo
    |> serializeToJson

