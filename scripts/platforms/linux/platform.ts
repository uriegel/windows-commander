import { DialogBox, Result } from 'web-dialog-box'
import { Menubar, MenuItem } from 'web-menu-bar'
import { RootItem } from '../../engines/root'
import { activateClass } from '../../utils'
import { Platform } from "../platforms"
const { homedir } = window.require('os')
const { exec } = window.require('child_process')

const homeDir = homedir()

export class LinuxPlatform implements Platform {
    adaptWindow(dialog: DialogBox, /* activeFolderSetFocusToSet, */ menu: Menubar, itemHideMenu: MenuItem) {
        this.dialog = dialog
        this.menu = menu
        this.itemHideMenu = itemHideMenu
        //activeFolderSetFocus = activeFolderSetFocusToSet
    
        const titlebar = document.getElementById("titlebar")!
        titlebar.setAttribute("no-titlebar", "")
    
        const automode = localStorage.getItem("menuAutoMode") == "true"
        if (automode)
            menu.setAttribute("automode", "true")
        itemHideMenu.isChecked = automode
    }

    async hideMenu(hide: boolean) {
        if (hide) {
            const res = await this.dialog!.show({
                text: "Soll das Menü verborgen werden? Aktivieren mit Alt-Taste",
                btnOk: true,
                btnCancel: true,
                defBtnOk: true
            })
            //     activeFolderSetFocus()
            if (res.result == Result.Cancel) {
                this.itemHideMenu!.isChecked = false
                return
            }
        }
    
        localStorage.setItem("menuAutoMode", hide ? "true" : "false")
        this.menu!.setAttribute("automode", hide ? "true" : "false")
    }

    onDarkTheme(dark: boolean) {
        activateClass(document.body, "adwaita-dark", dark) 
        activateClass(document.body, "adwaita", !dark) 
    }

    async getDrives() {
        const runCmd = (cmd: string) => new Promise<string>(res => exec(cmd, (_: any, stdout: any) => res(stdout)))
        const drivesString = await runCmd('lsblk --bytes --output SIZE,NAME,LABEL,MOUNTPOINT,FSTYPE')
        const driveStrings = drivesString.split("\n")
        const columnsPositions = (() => {
            const title = driveStrings[0]
            const getPart = (key: string) => title.indexOf(key)
    
            return [
                0,
                getPart("NAME"),
                getPart("LABEL"),
                getPart("MOUNT"),
                getPart("FSTYPE")
            ] 
        })()
    
        //const takeOr = (text: string, alt: string) => text ? text : alt
        const constructDrives = (driveString: string) => {
            const getString = (pos1: number, pos2: number) =>
                driveString.substring(columnsPositions[pos1], columnsPositions[pos2]).trim()
            const trimName = (name: string) =>
                name.length > 2 && name[1] == '─'
                    ? name.substring(2)
                    : name
            const mount = getString(3, 4)
         
            return {
                description: getString(2, 3),
                name: trimName(getString(1, 2)),
                type: 1, // TODO: Drive types enum DriveType
                mountPoint: mount,
                isMounted: !!mount,
                driveType: driveString.substring(columnsPositions[4]).trim(),
                size: parseInt(getString(0, 1), 10)
            }
        }
    
        const items = [{ name: "~", description: "home", mountPoint: homeDir, isMounted: true, type: 1, size: 0 }]
            .concat(driveStrings
                .slice(1)
                .filter(n => n[columnsPositions[1]] > '~')
                .map(constructDrives)
        )
        const mounted = items.filter(n => n.isMounted)
        const unmounted = items.filter(n => !n.isMounted)
        return mounted.concat(unmounted) as RootItem[]
    } 

    private dialog: DialogBox | null = null
    private itemHideMenu: MenuItem | null = null
    private menu: Menubar | null = null
}