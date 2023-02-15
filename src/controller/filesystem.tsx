import { TableRowItem } from "virtual-table-react"
import IconName, { IconNameType } from "../components/IconName"
import { getPlatform, Platform } from "../globals"
import { Controller, ControllerResult, ControllerType, extractSubPath, formatDateTime, formatSize, makeTableViewItems, measureRow } from "./controller"
import { ExtendedItem, FolderItem, GetExtendedItemsResult, GetItemResult, request } from "./requests"
import { ROOT } from "./root"

const platform = getPlatform()
const driveLength = platform == Platform.Windows ? 3: 1

const renderBaseRow = (props: TableRowItem) => {
	var item = props as FolderItem
	return [
		(<IconName namePart={item.name} type={item.isParent ? IconNameType.Parent : item.isDirectory ? IconNameType.Folder : IconNameType.File } iconPath={item.iconPath} />),
		(<span className={item.exifDate ? "exif" : "" } >{formatDateTime(item.exifDate ?? item.time)}</span>),
		formatSize(item.size)
	]
}

const renderRow = (props: TableRowItem) => 
	platform == Platform.Windows 
	? renderBaseRow(props).concat(["version"])
	: renderBaseRow(props)

const getWindowsColumns = () => ({
	columns: [
		{ name: "Name", isSortable: true, subColumn: "Erw." },
		{ name: "Datum", isSortable: true },
		{ name: "Größe", isSortable: true, isRightAligned: true },
		{ name: "Version", isSortable: true}
	],
	renderRow,
	measureRow
})

const getLinuxColumns = () => ({
	columns: [
		{ name: "Name", isSortable: true, subColumn: "Erw." },
		{ name: "Datum", isSortable: true },
		{ name: "Größe", isSortable: true, isRightAligned: true }
	],
	renderRow,
	measureRow
})

const getColumns = platform == Platform.Windows ? getWindowsColumns : getLinuxColumns

export const getFileSystemController = (controller: Controller|null): ControllerResult =>
    controller?.type == ControllerType.FileSystem
    ? ({ changed: false, controller })
    : ({ changed: true, controller: { 
		type: ControllerType.FileSystem, 
		getColumns, 
		getExtendedItems,
		setExtendedItems,
		getItems,
		onEnter: (path, item, keys) => 
			(item as FolderItem).isDirectory
				? ({
                	processed: false, 
                	pathToSet: path + '/' + (item as FolderItem).name 
				}) 
				: (item as FolderItem).isParent && path.length > driveLength 
				?  ({
                	processed: false, 
                	pathToSet: path + '/' + (item as FolderItem).name,
					latestPath: extractSubPath(path)

				}) 
				: (item as FolderItem).isParent && path.length == driveLength
				? ({
                	processed: false, 
                	pathToSet: ROOT,
					latestPath: path
				}) 
				: { processed: true }
	}})

const getItems = async (path?: string) => {
	const res = await request<GetItemResult>("getfiles", {
		path: path ?? "",
		showHiddenItems: true
	})
	return { ...res, items: makeTableViewItems(res.items)}
}

const checkExtendedItemsWindows = (items: FolderItem[]) => 
	items.find(n => {
		const check = n.name.toLowerCase()
		return check.endsWith(".jpg") || check.endsWith(".png")
	})

const checkExtendedItemsLinux = checkExtendedItemsWindows

const checkExtendedItems = 
	platform == Platform.Windows
		? checkExtendedItemsWindows
		: checkExtendedItemsLinux

const getExtendedItems = async (path: string, items: TableRowItem[]): Promise<GetExtendedItemsResult> => 
	checkExtendedItems(items as FolderItem[])
		? request<GetExtendedItemsResult>("getextendeditems", {
			items: (items as FolderItem[]).map(n => n.name),
			path
		})
		: { path: "", extendedItems: [] }

const setExtendedItems = (items: TableRowItem[], extendedItems: ExtendedItem[]) => 
	items.map((n, i) => extendedItems[i].date ? {...n, exifDate: extendedItems[i].date} : n)