import { Column, VirtualTable } from "virtual-table-component"
import { Folder } from "../components/folder"
import { Engine, FolderItem, ItemResult } from "./engines"

export class NullEngine implements Engine {
    currentPath = ""
    isSuitable(path: string|null|undefined) { return false }
    async getItems(path: string|null|undefined, showHiddenItems?: boolean) {
        return { items: [], path: "" } as ItemResult
    }
    getColumns() { return [] }
    adaptRootColumns(columns: Column[]) { return  [] }
    getItemPath(item: FolderItem) { return "" }
    async getPath(item: FolderItem, refresh: ()=>void) { return {} }
    renderRow(item: FolderItem, tr: HTMLTableRowElement) {}
    saveWidths(widths: number[]) { }
    getSortFunction(column: number, isSubItem: boolean) { return null }
    disableSorting(table: VirtualTable, disable: boolean) {}
    async addExtendedInfos(path: string|undefined|null, items: FolderItem[], refresh: ()=>void) {}
    async renameItem(item: FolderItem, folder: Folder) {}
}