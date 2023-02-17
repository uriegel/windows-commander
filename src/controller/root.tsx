import { SpecialKeys, TableRowItem } from "virtual-table-react"
import IconName, { IconNameType } from "../components/IconName"
import { getPlatform, Platform } from "../globals"
import { Controller, ControllerResult, ControllerType, formatSize, makeTableViewItems, measureRow} from "./controller"
import { GetRootResult, request, RootItem } from "./requests"

export const ROOT = "root"
const platform = getPlatform()

const renderWindowsRow = (props: TableRowItem) => {
    var item = props as RootItem
    return [
        (<IconName namePart={item.name} type={IconNameType.Root } />),
        item.description,
        formatSize(item.size)
    ]
}

const renderLinuxRow = (props: TableRowItem) => {
    var item = props as RootItem
    return [
        (<IconName namePart={item.name} type={IconNameType.Root } />),
        item.description,
        item.mountPoint ?? "",
        formatSize(item.size)
    ]
}

const getWindowsColumns = () => ({
	columns: [
		{ name: "Name" },
		{ name: "Beschreibung" },
		{ name: "Größe", isRightAligned: true }
	],
	renderRow: renderWindowsRow,
	measureRow
})

const getLinuxColumns = () => ({
	columns: [
		{ name: "Name" },
        { name: "Bezeichnung" },
        { name: "Mountpoint" },
		{ name: "Größe", isRightAligned: true }
    ],
    getRowClasses,
	renderRow: renderLinuxRow,
	measureRow
})

const onWindowsEnter = (_: string, item: TableRowItem, keys: SpecialKeys) => 
({
    processed: false, 
    pathToSet: (item as RootItem).name
}) 

const onLinuxEnter = (_: string, item: TableRowItem, keys: SpecialKeys) => 
({
    processed: false, 
    pathToSet: (item as RootItem).mountPoint
}) 

const getColumns = platform == Platform.Windows ? getWindowsColumns : getLinuxColumns
const onEnter = platform == Platform.Windows ? onWindowsEnter : onLinuxEnter

export const getRootController = (controller: Controller|null): ControllerResult => 
    controller?.type == ControllerType.Root
    ? ({ changed: false, controller })
    : ({ changed: true, controller: { 
        type: ControllerType.Root, 
        getColumns,
        getItems,
        getExtendedItems: async () => ({ path: "", extendedItems: [] }),
        setExtendedItems: items=>items,
        onEnter,
        sort: (items: TableRowItem[])=>items
    }})

const getItems = async () => {
	const result = await request<GetRootResult>("getroot")
    return {
        path: ROOT,
        items: makeTableViewItems(result, undefined, false)
    }
}

const getRowClasses = (item: RootItem) => 
    item.isMounted == false
        ? ["notMounted"]
        : []

