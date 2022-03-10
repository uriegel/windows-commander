module Engine

type EngineType =
| None =      0     
| Root =      1
| Directory = 2

[<CLIMutable>]
type GetItems = {
    Path:    string option
    Engine:  EngineType
}

type ItemType =
| File      = 1
| Directory = 2
| Harddrive = 3
| Homedrive = 4

// TODO Linux Windows
type RootItem = {
    Name:        string
    Description: string
    MountPoint:  string
    Size:        int64
    DriveType:   string
    ItemType:    ItemType
    IsMounted:   bool
}

type ColumnsType = 
| Normal = 1
| Name   = 2
| Size   = 3  

type Column = {
    Name:   string
    Column: string
    Type:   ColumnsType   
}

type GetItemResult = {
    Items:   RootItem[]
    Path:    string
    Engine:  EngineType
    Columns: Column[] option
}

type IEngine = 
    abstract member Id : int with get
    abstract member getItems: getItems: GetItems -> Async<GetItemResult>
