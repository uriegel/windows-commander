export const DIRECTORY_TYPE = "directory"
import { formatDateTime, formatSize, getExtension, compareVersion } from "./rendertools.js"
import { ROOT } from "./root.js"
import { FILE, DIRECTORY } from '../commander.js'
import {
    pathDelimiter,
    adaptDirectoryColumns,
    parentIsRoot,
    adaptDisableSorting,
    createFolder as platformCreateFolder,
    addExtendedInfo as addAdditionalInfo,
    deleteItems as platformDeleteItems,
    copyItems as platformCopyItems,
    renameItem as platformRenameItem,
    deleteEmptyFolders as platformDeleteEmptyFolders,
    enhanceCopyConflictData,
    onEnter as platformOnEnter
} from "../platforms/switcher.js"

const { getFiles } = window.require('rust-addon')
const fspath = window.require('path')
const fs = window.require('fs')
const { stat } = window.require('fs/promises')

export const getDirectory = (folderId, path) => {
    const getType = () => DIRECTORY_TYPE
    
    let currentPath = ""

    const getItem = item => currentPath == pathDelimiter ? pathDelimiter + item.name : currentPath + pathDelimiter + item.name

    const deleteItems = items => platformDeleteItems(items.map(n => fspath.join(currentPath, n)))

    async function extractFilesInFolders(sourcePath, targetPath, items, sourceFolder) {

        const extractFiles = async (path, target) => await extractFilesInFolders(path, target, await sourceFolder.readDir(path), sourceFolder)

        const paths = (await Promise.all(items.map(async n => {
            const file = fspath.join(sourcePath, n.name)
            const targetFile = fspath.join(targetPath, n.name)
            return n.isDirectory
                ? extractFiles(file, targetFile) 
                : { file, 
                    targetFile, 
                    targetExists: fs.existsSync(targetFile)
                } 
        }))).flatMap(n => n)
        return paths
    }

    const getCopyConflicts = async (info, sourcePath, sourceFolder) => {
        const conflicts = info.filter(n => n.targetExists)
        const sources = await sourceFolder.getFilesInfos(conflicts.map(n => n.file), sourcePath)
        const targets = await getFilesInfos(conflicts.map(n => n.targetFile))
        return sources.map((n, i) => ({source: n, target: targets[i]}))
    }

    const getFilesInfos = async (files, subPath) => {
        const getFileInfos = async file => {
            const info = await stat(file)
            return await enhanceCopyConflictData({  
                file,       
                name: subPath ? file.substr(subPath.length + 1) : undefined,
                size: info.size,
                time: info.mtime,
            })
        }
        return await Promise.all(files.map(getFileInfos))
    }

    const prepareCopyItems = async (move, itemsType, several, fromLeft, copyInfo) => {
        const moveOrCopy = move ? "verschieben" : "kopieren"
        const text = copyInfo.conflicts.length == 0
            ? itemsType == FILE 
                ? several
                    ? `Möchtest Du die Datei ${moveOrCopy}?`
                    : `Möchtest Du die Dateien ${moveOrCopy}?`
                : itemsType == DIRECTORY
                ?  several
                    ? `Möchtest Du den Ordner ${moveOrCopy}?`
                    : `Möchtest Du die Ordner ${moveOrCopy}?`
                : `Möchtest Du die Einträge ${moveOrCopy}?`
            : itemsType == FILE 
                ? several
                    ? `Datei ${moveOrCopy}, Einträge überschreiben?`
                    : `Dateien ${moveOrCopy}, Einträge überschreiben?`
                : itemsType == DIRECTORY
                ?  several
                    ? `Ordner ${moveOrCopy}, Einträge überschreiben?`
                    : `Ordner ${moveOrCopy}, Einträge überschreiben?`
                : `Möchtest Du die Einträge ${moveOrCopy}, Einträge überschreiben?`
        
        copyInfo.dialogData = {
            text,
            slide: fromLeft,
            slideReverse: !fromLeft,
            btnCancel: true
        }
        if (copyInfo.conflicts.length == 0) 
            copyInfo.dialogData.btnOk = true
        else {
            const copyConflicts = document.getElementById('copy-conflicts')
            copyConflicts.setItems(copyInfo.conflicts)
            copyInfo.dialogData.extended = "copy-conflicts"
            copyInfo.dialogData.btnYes = true
            copyInfo.dialogData.btnNo = true
            copyInfo.dialogData.fullscreen = true
            const notOverwrite = copyInfo.conflicts.filter(n => n.source.time.getTime() < n.target.time.getTime()).length > 0
            if (notOverwrite)
                copyInfo.dialogData.defBtnNo = true
            else
                copyInfo.dialogData.defBtnYes = true
        }

        return copyInfo 
    }

    const copyItems = platformCopyItems

    const deleteEmptyFolders = platformDeleteEmptyFolders

    const createFolder = async newFolder => await platformCreateFolder(fspath.join(currentPath, newFolder))

    const renameItem = async (item, newName) => await platformRenameItem(fspath.join(currentPath, item), fspath.join(currentPath, newName))

    const onEnter = file => {
        platformOnEnter(file, currentPath)
    }

    const readDir = async path => {
        path = fspath.normalize(path).replace(":.", ":\\")
        return await getFiles(path)
    }

