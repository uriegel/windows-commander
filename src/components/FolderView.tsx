import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import './FolderView.css'
import VirtualTable, { createEmptyHandle, OnSort, SpecialKeys, TableRowItem, VirtualTableHandle } from 'virtual-table-react'
import { checkController, Controller, createEmptyController } from '../controller/controller'
import { ROOT } from '../controller/root'
import { FolderItem } from '../controller/requests'

export type FolderViewHandle = {
    setFocus: ()=>void
    refresh: ()=>void
}

export const createEmptyFolderHandle = () => ({
    setFocus: () => { },
    refresh: () => {}
})

interface FolderViewProp {}

const FolderView = forwardRef<FolderViewHandle, FolderViewProp>(({}, ref) => {

    useImperativeHandle(ref, () => ({
        setFocus() { virtualTable.current.setFocus() },
        refresh() { changePath(path) }
    }))

    const virtualTable = useRef<VirtualTableHandle>(createEmptyHandle())
    const controller = useRef<Controller>(createEmptyController())
    const sortIndex = useRef(0)
    const sortDescending = useRef(false)

    const [items, setItems] = useState([] as TableRowItem[])
    const [path, setPath] = useState("")
    
    const onSort = async (sort: OnSort) => {
        sortIndex.current = sort.column
        sortDescending.current = sort.isDescending
        const newItems = controller.current.sort(items, sort.isSubColumn ? 10 : sortIndex.current, sortDescending.current)
        setItems(newItems)
        const name = (items[virtualTable.current.getPosition()] as FolderItem).name
        virtualTable.current.setPosition(newItems.findIndex(n => (n as FolderItem).name == name))
    }

    const onColumnWidths = (widths: number[]) => {
		if (widths.length == 4)
			localStorage.setItem("widths", JSON.stringify(widths))
	} 

    const refPath = useRef("")

    useEffect(() => virtualTable.current.setFocus(), [])

    useEffect(() => {
        changePath(ROOT)
    }, [setItems])

    const changePath = async (path: string, latestPath?: string) => {
        const result = checkController(path, controller.current)
        if (result.changed) {
            controller.current = result.controller
            virtualTable.current.setColumns(controller.current.getColumns())
        }

        const items = await controller.current.getItems(path, sortIndex.current, sortDescending.current)
        setPath(items.path)
        setItems(items.items)
        const pos = latestPath ? items.items.findIndex(n => (n as any).name == latestPath) : 0
        virtualTable.current.setInitialPosition(pos, items.items.length)
        refPath.current = items.path
        const extendedInfoItems = await controller.current.getExtendedItems(items.path, items.items)
        if (extendedInfoItems.path == refPath.current) 
            setItems(controller.current.setExtendedItems(items.items, extendedInfoItems.extendedItems))    
    }

    const onEnter = (item: TableRowItem, keys: SpecialKeys) => {
        const result = controller.current.onEnter(path, item, keys)
        if (!result.processed && result.pathToSet) 
            changePath(result.pathToSet, result.latestPath)
    }

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) =>  {
        console.log("e", e)
        setPath(e.target.value)
    }

    const onInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.code == "Enter") {
            changePath(path)
            virtualTable.current.setFocus()
            e.stopPropagation()
            e.preventDefault()
        }
    }

    const onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => 
        setTimeout(() => e.target.select())
        
    return (
        <>
            <input className="pathInput" value={path} onChange={onInputChange} onKeyDown={onInputKeyDown} onFocus={onInputFocus} />
            <div className="tableContainer">
                <VirtualTable ref={virtualTable} items={items} onSort={onSort}
                    onColumnWidths={onColumnWidths} onEnter={onEnter} />
            </div>
        </>
    )
})

export default FolderView

// TODO show hidden
// TODO isHidden hide 
// TODO Restrict items
// TODO Error from getItems/tooltip from dialog-box-react
// TODO SSE for theme detection?
// TODO css themes windows windows dark, adwaita and adwaita dark

