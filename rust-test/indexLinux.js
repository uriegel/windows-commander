const { initGtk, getIcon, getFiles, copyFile, getCopyStatus, getExifDate, trashFile } = require("rust-addon")

console.log("Testing Rust (Javascript side)")

initGtk()

console.log("system icon", getIcon(".pdf", 16))

//var timer = setTimeout(() => console.log("Progress", getCopyStatus()), 40)
//var files = getFiles("/home/uwe")
var files = getFiles(("/home/uwe"))
//clearTimeout(timer)const trashFileAsync = file => new Promise((res, rej) => trashFile(file, err => err ? rej(err) : res()))
console.log("files")
console.log("files", files)

async function copyFileAsnyc(source, target, cb, move, overwrite) {
    var timer = setInterval(() => {
        const status = getCopyStatus()
        if (status)
            cb(status)
    }, 100)
    try {
        await copyFile(source, target, move || false, overwrite || false)
        clearInterval(timer)
    } catch (e) {
        throw (JSON.parse(e.message))
    } finally {
        clearInterval(timer)
    }
}

const run = async () => {

    console.log("Exif date no file", await getExifDate("/home/uwe/Bilder/Fotos/2021/Uwe/IMG_20210907_142241ddd.jpg"))
    console.log("Exif date", await getExifDate("/home/uwe/Bilder/Fotos/2021/Uwe/IMG_20210907_142241.jpg"))
    try {
        await trashFile("/etc/alsa")
    } catch (err) {
        console.log("Err copy", err)
    }
    try {
        await copyFileAsnyc("/home/uwe/Videos/raw/Goldeneye.mts", "/home/uwe/test/affe.mts", a => console.log("Progress", a))
    } catch (err) {
        console.log("Err copy", err)
    }
    await copyFileAsnyc("/home/uwe/Videos/raw/Goldeneye.mts", "/home/uwe/test/affe.mts", a => console.log("Progress", a), false, true)
    await trashFile("/home/uwe/test/affe.mts")
    try {
        await trashFile("/home/uwe/test/affe.mts")
    } catch (err) {
        const e = JSON.parse(err.message)
        console.log("Konnte nicht löschen", e.code, e.description)
    }
    await copyFileAsnyc("/home/uwe/Videos/raw/Goldeneye.mts", "/home/uwe/test/neuer/nocheiner/affe.mts", a => console.log("Progress", a), false, true)

    // try {
    //     await trashFileAsync("/home/uwe/test/affe23.mts")
    // } catch (err) {
    //     console.log("Err trashFileAsync", err)
    // }
    // try {
    //     await trashFileAsync("/etc/cron.daily/google-chrome")
    // } catch (err) {
    //     console.log("Err trashFileAsync", err)
    // }
}

run()

