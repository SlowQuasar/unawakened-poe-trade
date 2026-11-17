import path from 'path'
import { app, Tray, Menu, shell, nativeImage, dialog } from 'electron'
import type { ServerEvents } from './server'
import { mainMessages } from './i18n'

export class AppTray {
  public overlayKey = 'Shift + Space'
  private tray: Tray
  serverPort = 0

  constructor (server: ServerEvents) {
    const trayImage = nativeImage.createFromPath(
      path.join(__dirname, process.env.STATIC!, 'icon.ico')
    )

    this.tray = new Tray(trayImage)
    this.tray.setToolTip(`Unawakened PoE Trade v${app.getVersion()}`)
    this.rebuildMenu()

    server.onEventAnyClient('CLIENT->MAIN::user-action', ({ action }) => {
      if (action === 'quit') {
        app.quit()
      }
    })
  }

  rebuildMenu () {
    const text = mainMessages()
    const contextMenu = Menu.buildFromTemplate([
      {
        label: text.settingsLeague,
        click: () => {
          dialog.showMessageBox({
            title: mainMessages().settings,
            message: mainMessages().settingsHint(this.overlayKey)
          })
        }
      },
      {
        label: text.openBrowser,
        click: () => {
          shell.openExternal(`http://localhost:${this.serverPort}`)
        }
      },
      { type: 'separator' },
      {
        label: text.openConfig,
        click: () => {
          shell.openPath(path.join(app.getPath('userData'), 'apt-data'))
        }
      },
      {
        label: text.quit,
        click: () => {
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }
}
