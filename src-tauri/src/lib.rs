use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

fn show_window(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

fn show_main(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    show_window(&window)
}

fn get_or_create_quick_window(app: &tauri::AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window("quick") {
        return Ok(window);
    }

    WebviewWindowBuilder::new(
        app,
        "quick",
        WebviewUrl::App("index.html?window=quick".into()),
    )
    .title("ClipB Quick Copy")
    .inner_size(460.0, 560.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .build()
    .map_err(|error| error.to_string())
}

fn show_quick(app: &tauri::AppHandle) -> Result<(), String> {
    let window = get_or_create_quick_window(app)?;

    window.show().map_err(|error| error.to_string())?;
    window.center().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

fn toggle_quick(app: &tauri::AppHandle) -> Result<(), String> {
    let window = get_or_create_quick_window(app)?;

    let is_visible = window.is_visible().map_err(|error| error.to_string())?;

    if is_visible {
        window.hide().map_err(|error| error.to_string())?;
    } else {
        show_quick(app)?;
    }

    Ok(())
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    show_main(&app)
}

#[tauri::command]
fn hide_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn toggle_quick_window(app: tauri::AppHandle) -> Result<(), String> {
    toggle_quick(&app)
}

#[tauri::command]
fn hide_quick_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quick") {
        window.hide().map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            show_main_window,
            hide_main_window,
            toggle_quick_window,
            hide_quick_window,
            quit_app
        ])
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new().build(),
            )?;

            app.handle().plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                None,
            ))?;

            let open_item = MenuItem::with_id(app, "open", "Open ClipB", true, None::<&str>)?;
            let quick_item =
                MenuItem::with_id(app, "quick", "Quick Copy", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit ClipB", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&open_item, &quick_item, &quit_item])?;

            TrayIconBuilder::with_id("clipb-tray")
                .tooltip("ClipB")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        let _ = show_main(app);
                    }
                    "quick" => {
                        let _ = toggle_quick(app);
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        let _ = show_main(app);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();

                let _ = window.hide();
            }
            WindowEvent::Resized(_) => {
                if window.label() == "main" {
                    if let Ok(true) = window.is_minimized() {
                        let _ = window.hide();
                    }
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}