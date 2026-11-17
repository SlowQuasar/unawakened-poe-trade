const messages = {
  ko: {
    settingsLeague: '설정 / 리그',
    settings: '설정',
    openBrowser: '브라우저에서 열기',
    openConfig: '설정 폴더 열기',
    quit: '종료',
    settingsHint: (key: string) => `Path of Exile을 실행하고 "${key}" 키를 누른 다음 톱니바퀴 아이콘 버튼을 클릭하세요.`,
    noAccessTitle: 'PoE 창 - 접근 권한 없음',
    noAccessMessage: 'Path of Exile이 관리자 권한으로 실행 중입니다.\n\nUnawakened PoE Trade를 관리자 권한으로 다시 실행하세요.'
  },
  en: {
    settingsLeague: 'Settings/League',
    settings: 'Settings',
    openBrowser: 'Open in Browser',
    openConfig: 'Open config folder',
    quit: 'Quit',
    settingsHint: (key: string) => `Open Path of Exile and press "${key}". Click on the button with cog icon there.`,
    noAccessTitle: 'PoE window - No access',
    noAccessMessage: 'Path of Exile is running with administrator rights.\n\nYou need to restart Unawakened PoE Trade with administrator rights.'
  }
}

let language = 'ko'

export function setLanguage (value: string) {
  language = value
}

export function mainMessages () {
  return language === 'ko' ? messages.ko : messages.en
}
