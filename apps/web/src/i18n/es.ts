/** Spanish is the reference dictionary: every other locale is typed against its
 *  keys, so a missing translation is a compile error rather than a blank label
 *  somebody notices in production. */
export const es = {
  'nav.home': 'Inicio',
  'nav.news': 'Noticias',
  'nav.connect': 'Cómo conectar',
  'nav.status': 'Estado',
  'nav.account': 'Mi cuenta',
  'nav.register': 'Crear cuenta',
  'nav.login': 'Entrar',
  'nav.logout': 'Cerrar sesión',
  'nav.admin': 'Administración',
  'nav.menu': 'Menú',
  'nav.close': 'Cerrar',
  'nav.language': 'Idioma',
  'nav.theme': 'Cambiar entre claro y oscuro',

  'hero.eyebrow': 'Mists of Pandaria',
  'hero.title': 'Redescubre la aventura en su forma más pura',
  'hero.body':
    'Un reino 5.4.8 con el continente entero abierto. Crea tu cuenta en un minuto y baja de la Isla Errante.',
  'hero.primary': 'Crear cuenta',
  'hero.secondary': 'Cómo conectar',
  'hero.note': 'Cliente 5.4.8 para Windows y Mac',
  'hero.replay': 'Repetir el vídeo',
  'hero.pause': 'Pausar el vídeo',

  'features.title': 'Lo que te espera',
  'features.scenarios.title': 'Escenarios',
  'features.scenarios.body': 'Aventuras instanciadas cortas para tres jugadores, sin buscar tanque.',
  'features.challenges.title': 'Modos desafío',
  'features.challenges.body': 'Mazmorras cronometradas con oro, plata y bronce, y monturas de recompensa.',
  'features.pets.title': 'Duelos de mascotas',
  'features.pets.body': 'Colecciona y combate con mascotas por todas las zonas de la expansión.',
  'features.dungeons.title': 'Mazmorras y bandas',
  'features.dungeons.body': 'De la Sien Celestial a Orgrimmar Asediado, con sus tres dificultades.',
  'features.pandaren.title': 'Pandaren',
  'features.pandaren.body': 'La raza neutral: elige facción al terminar la Isla Errante.',

  'panels.title': 'La expansión, completa',
  'panels.levelcap.title': 'Nivel máximo 90',
  'panels.levelcap.body':
    'Cinco niveles nuevos repartidos por seis zonas, del Bosque de Jade a la Cima de Kun-Lai, con la progresión de reputación intacta.',
  'panels.talents.title': 'Talentos y especializaciones rehechos',
  'panels.talents.body':
    'El árbol de talentos de 5.0: una elección cada quince niveles, y la especialización decide el resto. Nada de builds copiadas.',
  'panels.timeless.title': 'La Isla Intemporal',
  'panels.timeless.body':
    'El contenido final del parche 5.4: raros a cielo abierto, cofres escondidos y equipo intemporal para tus alters.',
  'panels.alts.title': 'Amable con los alters',
  'panels.alts.body':
    'Reputación compartida por cuenta, mazmorras de nivel máximo accesibles y tasas ajustadas para que un segundo personaje no sea un castigo.',

  'news.title': 'Últimas noticias',
  'news.all': 'Ver todas',
  'news.empty': 'Todavía no hay noticias publicadas.',
  'news.back': 'Volver a noticias',
  'news.published': 'Publicado el',
  'news.readMore': 'Leer más',
  'news.notFound': 'No encontramos esa noticia.',

  'status.title': 'Estado del reino',
  'status.realm': 'Reino',
  'status.online': 'En línea',
  'status.offline': 'Fuera de línea',
  'status.players': 'Jugadores conectados',
  'status.uptime': 'Tiempo activo',
  'status.updated': 'Actualizado',
  'status.unknown': 'Sin datos',

  'connect.title': 'Cómo conectar',
  'connect.intro':
    'Necesitas un cliente de World of Warcraft 5.4.8 (compilación 18414). Estos son los tres pasos.',
  'connect.step1.title': 'Consigue el cliente 5.4.8',
  'connect.step1.body':
    'Cualquier cliente 5.4.8 build 18414 sirve. No hace falta parchear nada más.',
  'connect.step2.title': 'Edita el realmlist',
  'connect.step2.body':
    'Abre WTF/Config.wtf con un editor de texto y deja una sola línea con el realmlist de abajo.',
  'connect.step3.title': 'Entra con tu cuenta',
  'connect.step3.body':
    'Ejecuta Wow.exe y usa el usuario y la contraseña de la cuenta que creaste aquí.',
  'connect.copy': 'Copiar',
  'connect.copied': 'Copiado',
  'connect.faq': 'Preguntas frecuentes',

  'faq.client.q': '¿Dónde consigo el cliente?',
  'faq.client.a':
    'No lo distribuimos. Cualquier copia de 5.4.8 build 18414 funciona; si ya jugaste la expansión en su momento, la tuya sirve.',
  'faq.account.q': '¿La cuenta del juego es la misma que la de la web?',
  'faq.account.a':
    'Sí. Creas una sola cuenta y la usas tanto en el cliente como para entrar aquí.',
  'faq.password.q': 'Olvidé mi contraseña.',
  'faq.password.a':
    'Escríbenos desde el correo con el que registraste la cuenta y la restablecemos.',
  'faq.rates.q': '¿Qué tasas tiene el reino?',
  'faq.rates.a':
    'Progresión x1 en experiencia, con reputación y profesiones ajustadas para que subir un alter no sea una segunda vida.',

  'register.title': 'Crea tu cuenta de juego',
  'register.description': 'Una cuenta para el cliente y para la web.',
  'register.username': 'Usuario',
  'register.usernameHint': 'De 3 a 32 caracteres. Es el que escribes en el cliente.',
  'register.email': 'Correo electrónico',
  'register.password': 'Contraseña',
  'register.passwordHint': 'Ocho caracteres como mínimo.',
  'register.submit': 'Crear cuenta',
  'register.success': 'Cuenta creada. Ya puedes entrar desde el cliente.',
  'register.error': 'Algo salió mal. Inténtalo otra vez.',
  'register.haveAccount': '¿Ya tienes cuenta?',

  'login.title': 'Entrar',
  'login.description': 'Entra con la misma cuenta que usas en el juego.',
  'login.submit': 'Entrar',
  'login.error': 'Usuario o contraseña incorrectos.',
  'login.noAccount': '¿No tienes cuenta?',

  'footer.notAffiliated':
    'Sitio no oficial, sin relación con Blizzard Entertainment. World of Warcraft es una marca registrada de Blizzard Entertainment, Inc.',
  'footer.legal': 'Legal',
  'footer.rules': 'Normas del reino',
  'footer.contact': 'Contacto',

  'error.notFound.title': 'Esta página no existe',
  'error.notFound.body': 'El enlace que seguiste no lleva a ninguna parte. Vuelve al inicio.',
  'error.generic': 'Algo salió mal.',
} as const;

export type TranslationKey = keyof typeof es;
