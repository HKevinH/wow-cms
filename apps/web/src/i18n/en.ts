import type { TranslationKey } from './es';

/** Typed against the Spanish dictionary's keys, so adding a string there without
 *  translating it here fails the build instead of falling back silently. */
export const en: Record<TranslationKey, string> = {
  'nav.home': 'Overview',
  'nav.news': 'News',
  'nav.connect': 'How to connect',
  'nav.status': 'Realm status',
  'nav.account': 'My account',
  'nav.register': 'Create account',
  'nav.login': 'Log in',
  'nav.logout': 'Log out',
  'nav.admin': 'Administration',
  'nav.menu': 'Menu',
  'nav.close': 'Close',
  'nav.language': 'Language',
  'nav.theme': 'Switch between light and dark',

  'hero.eyebrow': 'Mists of Pandaria',
  'hero.title': 'Rediscover adventure in its purest form',
  'hero.body':
    'A 5.4.8 realm with the whole continent open. Make an account in a minute and step off the Wandering Isle.',
  'hero.primary': 'Create account',
  'hero.secondary': 'How to connect',
  'hero.note': '5.4.8 client, Windows and Mac',
  'hero.replay': 'Replay the video',
  'hero.pause': 'Pause the video',

  'adventure.eyebrow': 'Pandaria awaits',
  'adventure.title': 'Your classic adventure continues',
  'adventure.body':
    'Leave the chaos behind and discover a continent lost in the mists. Explore its ruins, gather your allies and defend Pandaria from a threat that has waited for centuries.',
  'adventure.imageAlt': 'Pandaren adventurers ready to explore Pandaria',

  'features.title': 'Notable features',
  'features.description':
    'Return to the mist-shrouded lands of Pandaria, a realm of mystery and wonder returning with a renewed sense of adventure.',
  'features.scenarios.title': 'Scenarios',
  'features.scenarios.body': 'Short instanced adventures for three players, no tank to find.',
  'features.challenges.title': 'Challenge modes',
  'features.challenges.body': 'Timed dungeon runs for gold, silver and bronze, with mounts to earn.',
  'features.pets.title': 'Pet battles',
  'features.pets.body': 'Collect and duel battle pets across every zone in the expansion.',
  'features.dungeons.title': 'New dungeons, raids and scenarios',
  'features.dungeons.body': 'Fight through new Pandaria dungeons, redesigned heroic dungeons, raids and scenarios.',
  'features.pandaren.title': 'Pandaren',
  'features.pandaren.body': 'Become one of the enigmatic Pandaren and join either the Horde or the Alliance.',
  'features.monk.title': 'Monk class',
  'features.monk.body': 'Master the mystical monk paths of the windwalker, mistweaver and brewmaster.',
  'features.levelcap.title': 'New level cap',
  'features.levelcap.body': 'Defend Azeroth and learn new talents as you advance all the way to level 90.',
  'features.lands.title': 'New and lush lands',
  'features.lands.body': 'Explore Pandaria\'s new zones and the Wandering Isle, the Pandaren starting area.',

  'panels.title': 'The whole expansion',
  'panels.levelcap.title': 'Level cap 90',
  'panels.levelcap.body':
    'Five new levels to explore Pandaria and progress all the way to level 90.',
  'panels.pandaren.title': 'Pandaren and monk',
  'panels.pandaren.body':
    'Meet the Pandaren, choose a faction after the Wandering Isle, and master the new monk class.',
  'panels.dungeons.title': 'Dungeons, raids and scenarios',
  'panels.dungeons.body':
    'Group adventures, new dungeons and raids across the complete expansion.',
  'panels.challenges.title': 'Challenge mode dungeons',
  'panels.challenges.body':
    'Race the clock, improve your time and earn cosmetic rewards by mastering each dungeon.',
  'panels.lands.title': 'New lands and content',
  'panels.lands.body':
    'Explore the Jade Forest, Kun-Lai Summit, the Timeless Isle and other regions of Pandaria.',

  'news.title': 'Latest news',
  'news.all': 'All news',
  'news.empty': 'Nothing has been published yet.',
  'news.back': 'Back to news',
  'news.published': 'Published',
  'news.readMore': 'Read more',
  'news.notFound': 'We could not find that post.',

  'status.title': 'Realm status',
  'status.realm': 'Realm',
  'status.online': 'Online',
  'status.offline': 'Offline',
  'status.players': 'Players online',
  'status.uptime': 'Uptime',
  'status.updated': 'Updated',
  'status.unknown': 'No data',

  'connect.title': 'How to connect',
  'connect.intro':
    'You need a World of Warcraft 5.4.8 client (build 18414). Three steps and you are in.',
  'connect.step1.title': 'Get a 5.4.8 client',
  'connect.step1.body': 'Any 5.4.8 build 18414 client works. Nothing else needs patching.',
  'connect.step2.title': 'Edit the realmlist',
  'connect.step2.body':
    'Open WTF/Config.wtf in a text editor and leave a single line with the realmlist below.',
  'connect.step3.title': 'Log in with your account',
  'connect.step3.body':
    'Run Wow.exe and use the username and password of the account you made here.',
  'connect.copy': 'Copy',
  'connect.copied': 'Copied',
  'connect.faq': 'Frequently asked',

  'faq.client.q': 'Where do I get the client?',
  'faq.client.a':
    'We do not distribute it. Any copy of 5.4.8 build 18414 works; if you played the expansion at the time, yours will do.',
  'faq.account.q': 'Is the game account the same as the website account?',
  'faq.account.a': 'Yes. You make one account and use it both in the client and here.',
  'faq.password.q': 'I forgot my password.',
  'faq.password.a': 'Write to us from the address you registered with and we will reset it.',
  'faq.rates.q': 'What rates does the realm run?',
  'faq.rates.a':
    'x1 experience, with reputation and professions tuned so levelling an alt is not a second life.',

  'register.title': 'Create your game account',
  'register.description': 'One account for the client and for the website.',
  'register.username': 'Username',
  'register.usernameHint': '3 to 32 characters. This is what you type in the client.',
  'register.email': 'Email',
  'register.password': 'Password',
  'register.passwordHint': 'At least eight characters.',
  'register.submit': 'Create account',
  'register.success': 'Account created. You can log in from the client now.',
  'register.error': 'Something went wrong. Try again.',
  'register.haveAccount': 'Already have an account?',

  'login.title': 'Log in',
  'login.description': 'Log in with the same account you use in game.',
  'login.submit': 'Log in',
  'login.error': 'Username or password is incorrect.',
  'login.noAccount': 'No account yet?',

  'footer.notAffiliated':
    'Unofficial site, not affiliated with Blizzard Entertainment. World of Warcraft is a trademark of Blizzard Entertainment, Inc.',
  'footer.legal': 'Legal',
  'footer.rules': 'Realm rules',
  'footer.contact': 'Contact',

  'error.notFound.title': 'This page does not exist',
  'error.notFound.body': 'The link you followed goes nowhere. Head back to the front page.',
  'error.generic': 'Something went wrong.',
};
