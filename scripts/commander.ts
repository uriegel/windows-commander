import 'web-electron-titlebar'
import 'web-menu-bar'
import 'web-dialog-box'
import 'grid-splitter'
import 'web-pie-progress'
import './components/folder'
import { Menubar, MenuItem } from 'web-menu-bar'
import { initialize as initializeMenu } from './menu'
import { showViewer as viewer } from './viewer'
import { DialogBox } from 'web-dialog-box'
import { Platform } from './platforms/platforms'
import { Folder } from './components/folder'

var currentPath = ""
const folderLeft = document.getElementById("folderLeft")! as Folder
const folderRight = document.getElementById("folderRight")! as Folder
var activeFolder = folderLeft

const dialog = document.querySelector('dialog-box') as DialogBox

const statusText = document.getElementById("statusText")!
const dirsText = document.getElementById("dirs")!
const filesText = document.getElementById("files")!
const menu = document.getElementById("menu")! as Menubar

menu.addEventListener('menuclosed', () => activeFolder.setFocus())

folderLeft.addEventListener("onFocus", () => activeFolder = folderLeft)
folderRight.addEventListener("onFocus", () => activeFolder = folderRight)
folderLeft.addEventListener("pathChanged", onPathChanged)
folderRight.addEventListener("pathChanged", onPathChanged)
folderLeft.addEventListener("tab", () => folderRight.setFocus())
folderRight.addEventListener("tab", () => folderLeft.setFocus())

export type Commander = {
    showViewer: (show: boolean)=>void
    hideMenu: (hide: boolean)=>void
}

function showViewer(show: boolean) {
    currentPath = "/home/uwe/Bilder/Fotos/2019/Bild267.jpg"
    currentPath = "/home/uwe/Videos/Tatort - Fürchte Dich.mp4"
    //currentPath = "/home/uwe/Bücher/Beginning Blender.pdf"
    viewer(show, currentPath)
}

function hideMenu(hide: boolean) {
    Platform.hideMenu(hide)
}

function onPathChanged(evt: Event) {
    const detail = (evt as CustomEvent).detail
    currentPath = detail.path
    //refreshViewer(detail.path)
    setStatus(detail.path, detail.dirs, detail.files)
}

function setStatus(path: string, dirs: number, files: number) {
    statusText.innerText = `${path}`
    dirsText.innerText = `${dirs ? dirs - 1 : "" } Verz.` 
    filesText.innerText = `${dirs ? files : "" } Dateien` 
}

const commander: Commander = {
    showViewer,
    hideMenu
}

Platform.adaptWindow(dialog, menu, document.getElementById("hidemenu") as MenuItem)

const themeChanges = window.require("theme-change-detect")
themeChanges.register((theme: any) => Platform.onDarkTheme(theme.isDark))
Platform.onDarkTheme(themeChanges.getTheme().isDark)

folderLeft.setFocus()
initializeMenu(commander)
