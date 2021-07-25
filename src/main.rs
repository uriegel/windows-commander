use webview_app::app::{App, AppSettings, WarpSettings};
use crate::server::server;

#[cfg(target_os = "linux")]
use webview_app::app::InitData;

mod server;
mod requests;
mod eventsink;
#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
fn on_init(data: InitData) {
    use gtk::{HeaderBar, prelude::{BuilderExtManual, GtkApplicationExt, HeaderBarExt, ToVariant}};
    use webkit2gtk::traits::WebViewExt;
    use webview_app::app::{connect_msg_callback};
    use gio::{
        SimpleAction, traits::ActionMapExt
    };

    use crate::{linux::progress::Progress, server::DeleteItems};
    
    let builder = data.builder.as_ref().expect("GTK Builder not available");
    Progress::new(builder, &data.state);
    
    let initial_state = "".to_variant();
    let webview_clone = data.webview.clone();

    let action = SimpleAction::new_stateful("themes", Some(&initial_state.type_()), &initial_state);
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
    data.application.add_action(&action);

    let headerbar: HeaderBar = builder.object("headerbar").unwrap();

    let webview_clone = data.webview.clone();

    connect_msg_callback(data.webview, move|cmd: &str, payload: &str|{ 
        match cmd {
            "title" => headerbar.set_subtitle(Some(payload)),
            "theme" => action.set_state(&payload.to_variant()),

            "test" => {
                

                let settings: DeleteItems = serde_json::from_str(payload).unwrap();
                let jason = serde_json::to_string(&settings).expect("msg")   ;

                webview_clone.run_javascript(
                                    &format!("endtest({})", jason),
                                    Some(&gio::Cancellable::new()),
                                    |_|{})
            
                },
            _ => {}
        }
    });

    let initial_bool_state = false.to_variant();
    let action = SimpleAction::new_stateful("showhidden", None, &initial_bool_state);
    let webview_clone = data.webview.clone();
    action.connect_change_state(move |a, s| {
        match s {
            Some(val) => {
                a.set_state(val);
                match val.get::<bool>(){
                    Some(show_hidden) => webview_clone.run_javascript(
                        &format!("showHidden({})", show_hidden),
                        Some(&gio::Cancellable::new()),
                        |_|{}),
                    None => println!("Could not set ShowHidden, could not extract from variant")
                }
            },
            None => println!("Could not set action")
        }
    });
    data.application.add_action(&action);
    data.application.set_accels_for_action("app.showhidden", &["<Ctrl>H"]);

    let initial_bool_state = false.to_variant();
    let action = SimpleAction::new_stateful("viewer", None, &initial_bool_state);
    let webview_clone = data.webview.clone();
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
    data.application.add_action(&action);
    data.application.set_accels_for_action("app.viewer", &["F3"]);
}

fn run_app() {
    let port = 9865;
    let app = App::new(
        AppSettings{
            title: "Commander".to_string(),
            enable_dev_tools: true,
            warp_settings: Some(WarpSettings{
                port: port,
                init_fn: Some(server)
            }),
            window_pos_storage_path: Some("commander".to_string()),
            #[cfg(target_os = "linux")]
            url: format!("http://localhost:{}?os=linux", port),
            #[cfg(target_os = "linux")]
            on_app_init: Some(on_init),
            #[cfg(target_os = "linux")]
            application_id: "de.uriegel.commander".to_string(),
            #[cfg(target_os = "linux")]
            use_glade: true,
            ..Default::default()
        });
    app.run();
}

fn main() {
    run_app();
}



