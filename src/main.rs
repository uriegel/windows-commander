#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// Allows console to show up in debug build but not release build.

pub static APP_ID: &str = "de.uriegel.commander";

mod cancellations;
mod directory;
mod error;
mod extended_items;
mod httpserver;
mod str;
mod requests;
mod requests_http;
mod request_error;
mod tracks;
mod progresses;
use include_dir::include_dir;
#[cfg(target_os = "linux")]
use linux::headerbar::HeaderBar;
#[cfg(target_os = "linux")]
use gtk::prelude::StaticTypeExt;
#[cfg(target_os = "linux")]
use linux::progress_display::ProgressDisplay;

#[cfg(target_os = "windows")]
use std::sync::{Arc, Mutex};

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "windows")]
mod windows;

use requests::on_request;

use webview_app::{application::Application, webview::WebView};

pub const HTTP_PORT: u32 = 8000;

fn on_activate(app: &Application) -> WebView {
    let dir = include_dir!("website/dist");
    #[cfg(target_os = "windows")]
    let arc_dir = Some(Arc::new(Mutex::new(dir.clone())));
    let url = format!("http://localhost:{HTTP_PORT}/webroot/index.html");
    let query = format!("?port={HTTP_PORT}");
    let webview_builder = WebView::builder(app)
        .save_bounds()
        .title("Commander")
        .devtools(true)
        .webroot(dir.clone())
        .debug_url("http://localhost:5173")
        .url(&url)
        .query_string(&query)
        .default_contextmenu_disabled()
        .without_native_titlebar();

    #[cfg(target_os = "linux")]
    let webview_builder = webview_builder.with_builder(
        "/de/uriegel/commander/window.ui",
        move |builder| HeaderBar::new(builder),
    );

    #[cfg(target_os = "windows")]
    let webroot = arc_dir;
    #[cfg(target_os = "linux")]
    let webroot = None;

    httpserver::httpserver::HttpServerBuilder::new()
        .port(HTTP_PORT)
        .build()
        .run(webroot);

    #[cfg(target_os = "linux")]
    ProgressDisplay::ensure_type();        
    let webview = webview_builder.build();

    webview.connect_request(on_request);
    webview
}

fn main() {
    #[cfg(target_os = "linux")]
    gtk::gio::resources_register_include!("commander.gresource")
        .expect("Failed to register resources.");

    Application::new(APP_ID)
    .on_activate(on_activate)
    .run();
}

// TODO Copy Step 1: copy items without directory
// TODO Copy Step 1: copy items with directories (overwrite yes/no)
// TODO Copy Step 1: cancel F5 when copying is active
// TODO Copy Step 1: Cancel copy: error in ProgresstransitResponse
// TODO Move

// TODO Rename as copy
// TODO Rename items (extended rename)

// TODO delay on loaded?
// TODO Background color (dark, react not connected)

// TODO connect android

// TODO no // on linux status bar in root   

// TODO suppress developer tools in menus in release version

// TODO Copy Step 2: F5 when copying is active: queue jobs and recalculate bounds for progress dialog
// TODO Copy Step 3: Check if flatten source targets ad show conflicts
