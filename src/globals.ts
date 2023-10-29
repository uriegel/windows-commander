export enum Platform {
    Windows,
    Linux
}

export const getPlatform = memoize(() => {
    const platform = new URLSearchParams(window.location.search).get("platform")
    return platform == "windows"
        ? Platform.Windows
        : Platform.Linux
})

export const getTheme = () => new URLSearchParams(window.location.search).get("theme") || "adwaita"
export const isWindows = () => getTheme().startsWith("windows")

function memoize<T>(funcToMemoize: () => T) {
    let memoized: T|null = null
    return () => {
        if (!memoized)
            memoized = funcToMemoize()
        return memoized
    }       
}

