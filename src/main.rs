use std::{cell::RefCell};

use gio::{Resource, ResourceLookupFlags, Settings, SimpleAction, prelude::ApplicationExtManual, resources_register, traits::{ActionMapExt, ApplicationExt, SettingsExt}};
use glib::{MainContext, ToVariant, timeout_future_seconds};
use gtk::{Application, ApplicationWindow, Builder, HeaderBar, STYLE_PROVIDER_PRIORITY_APPLICATION, StyleContext, gdk::Screen, prelude::{BuilderExtManual, CssProviderExt, GtkApplicationExt, GtkWindowExt, HeaderBarExt, WidgetExt}};
use urlencoding::decode;
use webkit2gtk::{WebView, traits::{URISchemeRequestExt, WebContextExt, WebInspectorExt, WebViewExt}};

fn main() {
    let application = Application::new(Some("de.uriegel.commander"), Default::default());
    application.connect_activate(|app| {
        let resources_bytes = include_bytes!("../resources/resources.gresource");
        let resource_data = glib::Bytes::from(&resources_bytes[..]);
        let res = Resource::from_data(&resource_data).unwrap();
        resources_register(&res);

        let provider = gtk::CssProvider::new();
        provider.load_from_resource("/de/uriegel/commander/style.css");
        StyleContext::add_provider_for_screen(
            &Screen::default().expect("Error initializing gtk css provider."),
            &provider,
            STYLE_PROVIDER_PRIORITY_APPLICATION,
        );        

        let builder = Builder::from_resource("/de/uriegel/commander/main_window.glade");
        let window: ApplicationWindow = builder.object("window").expect("Couldn't get window");

        let settings = Settings::new("de.uriegel.commander");
        let width = settings.int("window-width");
        let height = settings.int("window-height");
        let is_maximized = settings.boolean("is-maximized");
        window.set_default_size(width, height);
        if is_maximized {
            window.maximize();
        }        

        let webview: WebView = builder.object("webview").expect("Couldn't get webview");
        let headerbar: HeaderBar = builder.object("headerbar").unwrap();
        webview.connect_context_menu(|_, _, _, _| true );

        let initial_state = "".to_variant();
        let action = SimpleAction::new_stateful("themes", Some(&initial_state.type_()), &initial_state);
        let webview_clone = webview.clone();
        action.connect_change_state(move |a, s| {
            match s {
            Some(val) => {
                a.set_state(val);
                match val.str(){
                    Some(theme) => 
                    webview_clone.run_javascript(&format!("setTheme('{}')", theme), Some(&gio::Cancellable::new()), |_|{}),
                    None => println!("Could not set theme, could not extract from variant")
                }
            },
            None => println!("Could not set theme")
        }
        });
        app.add_action(&action);

        connect_msg_callback(&webview, move|cmd: &str, payload: &str|{ 
            match cmd {
                "title" => headerbar.set_subtitle(Some(payload)),
                "theme" => action.set_state(&payload.to_variant()),
                _ => {}
            }
        });
        
        let webview_clone = webview.clone();
        let action = gio::SimpleAction::new("devtools", None);
        action.connect_activate(move |_,_| match webview_clone.inspector() {
            Some(inspector) => inspector.show(),
            None => println!("Could not show web inspector")
        });
        app.add_action(&action);        
        app.set_accels_for_action("app.devtools", &["F12"]);

        let initial_bool_state = false.to_variant();
        let action = SimpleAction::new_stateful("viewer", None, &initial_bool_state);
        let webview_clone = webview.clone();
        action.connect_change_state(move |a, s| {
            match s {
                Some(val) => {
                    a.set_state(val);
                    match val.get::<bool>(){
                        Some(show_viewer) => webview_clone.run_javascript(
                            &format!("showViewer({})", show_viewer),
                            Some(&gio::Cancellable::new()),
                            |_|{}),
                        None => println!("Could not show Viewer, could not extract from variant")
                    }
                },
                None => println!("Could not set action")
            }
        });
        app.add_action(&action);
        app.set_accels_for_action("app.viewer", &["F3"]);

        let context = webview.context().unwrap();
        fn get_content_type(path: &str)->Option<String> {
            match path {
                p if p.ends_with("js") => Some("application/javascript".to_string()),
                p if p.ends_with("css") => Some("text/css".to_string()),
                _ => None
            }
        }

        context.register_uri_scheme("provide", move |request|{
            let gpath = request.path().unwrap();
            let path = gpath.as_str();
            let gurl = request.uri().unwrap();
            let url = gurl.as_str();
            println!("Pfad {}  {}", path, url);
            let (subpath, content_type) = match path {
                "" => ("/index.html", Some("text/html".to_string())),
                a => (a, get_content_type(path))
            };

            // if let Some(content_type) = content_type {
            //     let path = "/de/uriegel/commander/web".to_string() + subpath;
            //     let (size, _) = res.info(&path, ResourceLookupFlags::NONE).unwrap();
            //     let istream = res.open_stream(&path, ResourceLookupFlags::NONE).unwrap();
            //     request.finish(&istream, size as i64, Some(&content_type));
            // }             
            if let Some(content_type) = content_type {

                let main_context = MainContext::default();
                let request_clone = request.clone();
                let subpath = subpath.to_string();
                let res_clone = res.clone();
                main_context.spawn_local(async move {

                    timeout_future_seconds(2).await;

                    let dirs = async_std::fs::read_dir("/").await;
                    println!("dirs {:?}", dirs);

                    let path = "/de/uriegel/commander/web".to_string() + &subpath;
                    let (size, _) = res_clone.info(&path, ResourceLookupFlags::NONE).unwrap();
                    let istream = res_clone.open_stream(&path, ResourceLookupFlags::NONE).unwrap();
                    request_clone.finish(&istream, size as i64, Some(&content_type));
                });
            } 
        });
        webview.load_uri("provide://content");

        context.register_uri_scheme("request", move |request|{
            
            let gurl = request.uri().unwrap();
            let url = std::str::from_utf8(&gurl.as_bytes()[10..]).unwrap();
            let pos = url.find("?");
            let (cmd, params) = if let Some(pos) = pos {
                let query = std::str::from_utf8(&(url.as_bytes()[pos+1..])).unwrap().replace("+", "%20");
                let decoded = decode(&query).unwrap().to_string();
                (std::str::from_utf8(&(url.as_bytes()[..pos])).unwrap(), Some(decoded))
            } else {
                (url, None)
            };

            // match cmd {
            //     "getroot" => {

                        
            //         });
            //     }
            // }
            println!("cmd: {}, query: {:?}, url: {}", cmd, params, url);
        });

        let r_size = RefCell::new((0, 0));
        let r_is_maximized = RefCell::new(is_maximized);
        let window_clone = window.clone();
            window.connect_configure_event(move |_,_| {
            let size = window_clone.size();
            let old_r_size = r_size.replace(size);
            if size.0 != old_r_size.0 || size.1 != old_r_size.1 {
                settings.set_int("window-width", size.0).ok();
                settings.set_int("window-height", size.1).ok();                
            }
            let is_maximized = window_clone.is_maximized();
            let old_r_is_maximized = r_is_maximized.replace(is_maximized);
            if old_r_is_maximized != is_maximized {
                settings.set_boolean("is-maximized", is_maximized).ok();                
            }
            false
        });        

        window.set_application(Some(app));
        window.show_all();
    });

    application.run();
}

pub fn connect_msg_callback<F: Fn(&str, &str)->() + 'static>(webview: &WebView, on_msg: F) {
    let webmsg = "!!webmesg!!";

    webview.connect_script_dialog(move|_, dialog | {
        let str = dialog.get_message();
        if str.starts_with(webmsg) {
            let msg = &str[webmsg.len()..];
            if let Some(pos) = msg.find("!!") {
                let cmd = &msg[0..pos];
                let payload = &msg[pos+2..];
                on_msg(cmd, payload);
            }
        }
        true
    });
}

// use webview_app::app::{App, AppSettings, WarpSettings};
// use crate::server::server;

// #[cfg(target_os = "linux")]
// use webview_app::app::InitData;

// mod server;
// mod requests;
// mod eventsink;
// #[cfg(target_os = "linux")]
// mod linux;
// #[cfg(target_os = "windows")]
// mod windows;

// #[cfg(target_os = "linux")]
// fn on_init(data: InitData) {
//     use gtk::{HeaderBar, prelude::{BuilderExtManual, GtkApplicationExt, HeaderBarExt, ToVariant}};
//     use webkit2gtk::traits::WebViewExt;
//     use webview_app::app::{connect_msg_callback};
//     use gio::{
//         SimpleAction, traits::ActionMapExt
//     };

//     use crate::{linux::progress::Progress, server::DeleteItems};
    
    



//     connect_msg_callback(data.webview, move|cmd: &str, payload: &str|{ 
//         match cmd {
//             "title" => headerbar.set_subtitle(Some(payload)),
//             "theme" => action.set_state(&payload.to_variant()),

//             "test" => {
                

//                 let settings: DeleteItems = serde_json::from_str(payload).unwrap();
//                 let jason = serde_json::to_string(&settings).expect("msg")   ;

//                 webview_clone.run_javascript(
//                                     &format!("endtest({})", jason),
//                                     Some(&gio::Cancellable::new()),
//                                     |_|{})
            
//                 },
//             _ => {}
//         }
//     });

//     let initial_bool_state = false.to_variant();
//     let action = SimpleAction::new_stateful("showhidden", None, &initial_bool_state);
//     let webview_clone = data.webview.clone();
//     action.connect_change_state(move |a, s| {
//         match s {
//             Some(val) => {
//                 a.set_state(val);
//                 match val.get::<bool>(){
//                     Some(show_hidden) => webview_clone.run_javascript(
//                         &format!("showHidden({})", show_hidden),
//                         Some(&gio::Cancellable::new()),
//                         |_|{}),
//                     None => println!("Could not set ShowHidden, could not extract from variant")
//                 }
//             },
//             None => println!("Could not set action")
//         }
//     });
//     data.application.add_action(&action);
//     data.application.set_accels_for_action("app.showhidden", &["<Ctrl>H"]);

// }

// fn run_app() {
//     let port = 9865;
//     let app = App::new(
//         AppSettings{
//             title: "Commander".to_string(),
//             enable_dev_tools: true,
//             warp_settings: Some(WarpSettings{
//                 port: port,
//                 init_fn: Some(server)
//             }),
//             window_pos_storage_path: Some("commander".to_string()),
//             #[cfg(target_os = "linux")]
//             url: format!("http://localhost:{}?os=linux", port),
//             #[cfg(target_os = "linux")]
//             on_app_init: Some(on_init),
//             #[cfg(target_os = "linux")]
//             application_id: "de.uriegel.commander".to_string(),
//             #[cfg(target_os = "linux")]
//             use_glade: true,
//             ..Default::default()
//         });
//     app.run();
// }

// fn main() {
//     run_app();
// }



