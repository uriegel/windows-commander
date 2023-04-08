import { TableColumns } from "virtual-table-react"
import { FolderViewItem } from "../components/FolderView"
import IconName, { IconNameType } from "../components/IconName"
import { GetItemResult, request } from "../requests/requests"
import { addParent, Controller, ControllerResult, ControllerType, formatDateTime, formatSize, sortItems } from "./controller"
import { getSortFunction } from "./filesystem"
import { REMOTES } from "./remotes"

export const REMOTE = "remote"

const renderRow = (item: FolderViewItem) => [
	(<IconName namePart={item.name} type={
        item.isParent
        ? IconNameType.Parent
        : item.isDirectory
        ? IconNameType.Folder
        : IconNameType.File}
        iconPath={item.name.getExtension()} />),
    formatDateTime(item?.time),
    formatSize(item.size)
]

const getRowClasses = (item: FolderViewItem) => 
	item.isHidden
		? ["hidden"]
		: []

const getColumns = () => ({
	columns: [
		{ name: "Name", isSortable: true, subColumn: "Erw." },
		{ name: "Datum", isSortable: true },
		{ name: "Größe", isSortable: true, isRightAligned: true }
	],
	getRowClasses,
	renderRow,
	draggable: true
} as TableColumns<FolderViewItem>)

const getItems = async (path: string, showHidden: boolean, sortIndex: number, sortDescending: boolean) => {
	const res = await request<GetItemResult>("getremotefiles", {
		path,
		showHiddenItems: showHidden
	})
	return { ...res, items: addParent(sort(res.items, sortIndex, sortDescending)) }
}

const sort = (items: FolderViewItem[], sortIndex: number, sortDescending: boolean) => 
	sortItems(items, getSortFunction(sortIndex, sortDescending), true) 

export const getRemoteController = (controller: Controller | null): ControllerResult => 
    controller?.type == ControllerType.Remote
    ? ({ changed: false, controller })
    : ({ changed: true, controller: { 
        type: ControllerType.Remote, 
        id: REMOTE,
        getColumns,
        getItems,
        getExtendedItems: async () => ({ path: "", exifTimes: [], versions: [] }),
        setExtendedItems: items=>items,
		onEnter: (path, item, keys) => 
			item.isParent && path.split("/").filter(n => n.length > 0).sideEffectForEach(n => console.log("Eintrag", n)).length - 1 == 1
			?  ({
				processed: false, 
				pathToSet: REMOTES,
				latestPath: path
			}) 
			: item.isParent
			? ({
				processed: false, 
				pathToSet: path.getParentPath(),
				latestPath: path.extractSubPath()
			}) 
			: item.isDirectory
			? ({
				processed: false, 
				pathToSet: path.appendPath(item.name)
			}) 
			: { processed: true },
        sort,
        itemsSelectable: true,
        appendPath: (path: string, subPath: string) => path.appendPath(subPath),
        rename: async () => null,
        createFolder: async () => null,
        deleteItems: async () => null,
    }})
