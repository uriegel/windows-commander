import { TableRowItem } from "virtual-table-react"
import IconName, { IconNameType } from "../components/IconName"
import { Controller, ControllerResult, ControllerType, formatDateTime, formatSize } from "./controller"
import { FolderItem, GetItemResult, request } from "./requests"

const renderRow = (props: TableRowItem) => {
	var item = props as FolderItem
	return [
		(<IconName namePart={item.name} type={item.isParent ? IconNameType.Parent : item.isDirectory ? IconNameType.Folder : IconNameType.File } iconPath={item.iconPath} />),
		formatDateTime(item.time),
		formatSize(item.size)
	]
}

const getColumns = () => ({
	columns: [
		{ name: "Name", isSortable: true, subColumn: "Erw." },
		{ name: "Datum" },
		{ name: "Größe", isRightAligned: true }
	],
	renderRow,
	measureRow: () => (<IconName namePart="Measure g" type={IconNameType.Folder} />),
})

export const getFileSystemController = (controller: Controller|null): ControllerResult =>
    controller?.type == ControllerType.FileSystem
    ? ({ changed: false, controller })
    : ({ changed: true, controller: { 
		type: ControllerType.FileSystem, 
		getColumns, 
		getItems 
	}})

const getItems = async (path?: string) => {
	return (await request<GetItemResult>("getfiles", {
		path: path ?? "",
		showHiddenItems: true
	})).items as TableRowItem[]
}