import { ref, computed } from 'vue';

/**
 * Minimal i18n for the site: the same three languages the app ships (English,
 * Brazilian Portuguese, Spanish). A dependency-free lookup is enough here —
 * every string is static copy, so vue-i18n's runtime (plurals, datetime, number
 * formats, message compiler) would be weight for nothing on a landing page.
 */
export const LOCALES = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'pt-br', label: 'Português (Brasil)', short: 'PT-BR' },
    { code: 'es', label: 'Español', short: 'ES' },
] as const;

export type LocaleCode = typeof LOCALES[number]['code'];

const STORAGE_KEY = 'gitbox_site_locale';

type Messages = Record<string, any>;

const en: Messages = {
    nav: { features: 'Features', screenshots: 'Screenshots', github: 'GitHub', download: 'Download' },
    hero: {
        badge_version: '{version} is out — projects, faster history and more',
        badge_generic: 'Now with projects, faster history and more',
        title_1: 'A Git client that keeps up',
        title_2: 'with you',
        subtitle: 'GitBox drives Git through a native libgit2 addon instead of shelling out — so history, diffs and branch switching feel instant, even on repositories with thousands of commits.',
        cta_download: 'Download for free',
        cta_source: 'View source',
        note: 'Windows and Linux · MIT licensed · No account required',
        shot_alt: "GitBox showing a repository's commit graph",
    },
    features: {
        eyebrow: 'Features',
        title: "Everything you reach for, nothing you don't",
        subtitle: "GitBox is built around the operations you run dozens of times a day, and it stays out of the way for the ones you don't.",
        speed: { title: 'Native speed', body: 'Git runs through a purpose-built C++ addon on libgit2 — statically linked, no system git required. Repositories with thousands of commits open instantly.' },
        history: { title: 'Visual history', body: 'A real commit graph with merge glyphs, tags and branch labels, virtualized so scrolling stays smooth no matter how deep the history goes.' },
        projects: { title: 'Projects', body: 'Group the repositories you work with into colour-coded projects. Switching context swaps the whole tab bar — one click instead of reopening tabs.' },
        diffs: { title: 'Monaco diffs', body: 'Side-by-side and inline diffs powered by the editor behind VS Code, with image, markdown and ribbon views for anything that is not plain text.' },
        conflicts: { title: 'Conflict editor', body: 'Merge conflicts open in a dedicated three-pane editor with per-hunk actions, so you resolve them where you already are.' },
        terminal: { title: 'Integrated terminal', body: 'A full terminal session (xterm.js + node-pty) docked in the workspace for the moments a GUI should get out of your way.' },
        themes: { title: 'Themeable', body: 'Every colour is a design token. Edit a theme in the app or install one from the community registry — the graph palette follows along.' },
        keyboard: { title: 'Keyboard centric', body: 'Global shortcuts for tabs, projects, terminal and settings, all listed in a searchable sheet and translated into every supported language.' },
        tags: { title: 'Tags and branches', body: 'Create, checkout and delete branches and tags from the sidebar, and see every one of them rendered right on the commit graph.' },
        prs: { title: 'Pull requests', body: 'Browse and open the pull requests of the repository you have checked out, and create a new one from the branch you are on.' },
        submodules: { title: 'Submodules', body: 'Add, sync and update nested repositories, and open a submodule as its own tab when you need to work inside it.' },
        stashes: { title: 'Stashes', body: 'Stash with or without untracked files, read what is inside each one, then apply or drop it without touching the terminal.' },
    },
    gallery: {
        eyebrow: 'A look inside',
        title: 'Built for long sessions',
        subtitle: 'Nine screens you will actually live in — not a landing-page mockup.',
        prev: 'Previous screenshot',
        next: 'Next screenshot',
        history: { label: 'History', title: 'The commit graph, drawn properly', caption: 'Branch labels, tags and merge glyphs on a virtualized list that stays smooth at thousands of commits.' },
        changes: { label: 'Local changes', title: 'Stage, review, commit', caption: 'A file tree of what changed with the diff right beside it, and the commit box always in reach.' },
        conflicts: { label: 'Conflicts', title: 'Decide a conflict without leaving the app', caption: 'Both sides are laid out with their branch and commit, so you can keep one outright — or open the editor.' },
        merge: { label: 'Merge editor', title: 'A real three-pane merge editor', caption: 'Current, result and incoming side by side, with per-hunk actions and a live count of what is left.' },
        projects: { label: 'Projects', title: 'Group repositories into projects', caption: 'Each project keeps its own tabs and colour; switching swaps the whole tab bar in one click.' },
        stashes: { label: 'Stashes', title: 'Stashes you can actually read', caption: 'Every stash with its branch, timestamp and contents, one click from being applied or dropped.' },
        statistics: { label: 'Statistics', title: 'Know your repository', caption: 'Commits, contributors, branches, size and churn, with the contribution split per developer.' },
        settings: { label: 'Settings', title: 'Tuned to your taste', caption: 'Language, date format, polling, themes and external tools — all in one place.' },
        log: { label: 'Command log', title: 'Nothing happens behind your back', caption: 'Every operation GitBox runs, with its output and duration, so you always know what it did.' },
    },
    downloads: {
        eyebrow: 'Download',
        title: 'Get GitBox',
        subtitle: 'Free and open source. Installs update themselves through the built-in updater, so this is the only download you need.',
        your_system: 'your system',
        failed: 'Could not reach the GitHub API — still retrying.',
        failed_hint: 'The release page below always works; the buttons will fill in on their own if the API answers.',
        open_release: 'Open the latest release on GitHub',
        retry: 'Try again',
        older: 'Looking for an older build?',
        browse: 'Browse all releases',
        no_mac: 'macOS builds are not published yet.',
        win_exe: { label: 'Installer (.exe)', hint: 'Recommended for Windows 10/11' },
        win_msi: { label: 'Package (.msi)', hint: 'For managed / silent installs' },
        appimage: { label: 'AppImage', hint: 'Runs anywhere — no install needed' },
        deb: { label: 'Debian (.deb)', hint: 'Debian, Ubuntu, Mint' },
        rpm: { label: 'Fedora (.rpm)', hint: 'Fedora, RHEL, openSUSE' },
        pacman: { label: 'Arch (.pacman)', hint: 'Arch, Manjaro' },
    },
    footer: { license: '— MIT licensed', source: 'Source', releases: 'Releases', issues: 'Issues', changelog: 'Changelog' },
    common: { back_to_top: 'Back to top', language: 'Language' },
};

const ptBr: Messages = {
    nav: { features: 'Recursos', screenshots: 'Telas', github: 'GitHub', download: 'Baixar' },
    hero: {
        badge_version: '{version} chegou — projetos, histórico mais rápido e mais',
        badge_generic: 'Agora com projetos, histórico mais rápido e mais',
        title_1: 'Um cliente Git que acompanha',
        title_2: 'o seu ritmo',
        subtitle: 'O GitBox fala com o Git por um addon nativo em libgit2, sem chamar processos externos — então histórico, diffs e troca de branch respondem na hora, mesmo em repositórios com milhares de commits.',
        cta_download: 'Baixar de graça',
        cta_source: 'Ver o código',
        note: 'Windows e Linux · Licença MIT · Sem conta',
        shot_alt: 'GitBox exibindo o grafo de commits de um repositório',
    },
    features: {
        eyebrow: 'Recursos',
        title: 'Tudo o que você usa, nada do que atrapalha',
        subtitle: 'O GitBox é construído em volta das operações que você repete dezenas de vezes por dia — e sai da frente nas outras.',
        speed: { title: 'Velocidade nativa', body: 'O Git roda por um addon C++ feito sob medida em cima da libgit2 — ligado estaticamente, sem depender do git do sistema. Repositórios com milhares de commits abrem na hora.' },
        history: { title: 'Histórico visual', body: 'Um grafo de commits de verdade, com marcas de merge, tags e rótulos de branch, virtualizado para rolar liso por mais fundo que o histórico vá.' },
        projects: { title: 'Projetos', body: 'Agrupe os repositórios em projetos com cor própria. Trocar de contexto troca a barra de abas inteira — um clique em vez de reabrir tudo.' },
        diffs: { title: 'Diffs com Monaco', body: 'Diffs lado a lado e em linha pelo editor que está por trás do VS Code, com visões de imagem, markdown e fita para o que não é texto puro.' },
        conflicts: { title: 'Editor de conflitos', body: 'Conflitos de merge abrem num editor dedicado de três painéis, com ações por bloco, para você resolver onde já está.' },
        terminal: { title: 'Terminal integrado', body: 'Uma sessão de terminal completa (xterm.js + node-pty) acoplada ao workspace, para os momentos em que a interface deve sair da frente.' },
        themes: { title: 'Temas', body: 'Toda cor é um design token. Edite um tema no app ou instale um do registro da comunidade — a paleta do grafo acompanha.' },
        keyboard: { title: 'Feito para o teclado', body: 'Atalhos globais para abas, projetos, terminal e configurações, todos listados numa folha com busca e traduzidos para todos os idiomas.' },
        tags: { title: 'Tags e branches', body: 'Crie, troque e apague branches e tags pela barra lateral, e veja todas elas desenhadas no próprio grafo de commits.' },
        prs: { title: 'Pull requests', body: 'Navegue e abra os pull requests do repositório em que você está, e crie um novo direto do branch atual.' },
        submodules: { title: 'Submódulos', body: 'Adicione, sincronize e atualize repositórios aninhados, e abra um submódulo como aba própria quando precisar trabalhar dentro dele.' },
        stashes: { title: 'Stashes', body: 'Guarde alterações com ou sem arquivos não rastreados, leia o conteúdo de cada stash e aplique ou descarte sem abrir o terminal.' },
    },
    gallery: {
        eyebrow: 'Por dentro',
        title: 'Feito para sessões longas',
        subtitle: 'Nove telas em que você realmente vai viver — não uma maquete de landing page.',
        prev: 'Tela anterior',
        next: 'Próxima tela',
        history: { label: 'Histórico', title: 'O grafo de commits, desenhado direito', caption: 'Rótulos de branch, tags e marcas de merge numa lista virtualizada que continua fluida com milhares de commits.' },
        changes: { label: 'Mudanças locais', title: 'Preparar, revisar, commitar', caption: 'A árvore do que mudou com o diff logo ao lado, e a caixa de commit sempre à mão.' },
        conflicts: { label: 'Conflitos', title: 'Decida um conflito sem sair do app', caption: 'Os dois lados aparecem com seu branch e commit, então dá para manter um direto — ou abrir o editor.' },
        merge: { label: 'Editor de merge', title: 'Um editor de merge de três painéis de verdade', caption: 'Atual, resultado e entrada lado a lado, com ações por bloco e a contagem do que ainda falta.' },
        projects: { label: 'Projetos', title: 'Agrupe repositórios em projetos', caption: 'Cada projeto guarda suas abas e sua cor; trocar troca a barra de abas inteira num clique.' },
        stashes: { label: 'Stashes', title: 'Stashes que dá para ler', caption: 'Cada stash com seu branch, horário e conteúdo, a um clique de ser aplicado ou descartado.' },
        statistics: { label: 'Estatísticas', title: 'Conheça o seu repositório', caption: 'Commits, contribuidores, branches, tamanho e churn, com a divisão de contribuição por pessoa.' },
        settings: { label: 'Configurações', title: 'Do seu jeito', caption: 'Idioma, formato de data, atualização automática, temas e ferramentas externas — tudo num lugar só.' },
        log: { label: 'Log de comandos', title: 'Nada acontece pelas suas costas', caption: 'Cada operação que o GitBox executa, com saída e duração, para você sempre saber o que ele fez.' },
    },
    downloads: {
        eyebrow: 'Download',
        title: 'Baixe o GitBox',
        subtitle: 'Livre e de código aberto. As instalações se atualizam sozinhas pelo updater embutido, então este é o único download necessário.',
        your_system: 'seu sistema',
        failed: 'Não deu para alcançar a API do GitHub — ainda tentando.',
        failed_hint: 'A página de releases abaixo sempre funciona; os botões se preenchem sozinhos se a API responder.',
        open_release: 'Abrir a última release no GitHub',
        retry: 'Tentar de novo',
        older: 'Procurando uma versão anterior?',
        browse: 'Ver todas as releases',
        no_mac: 'Builds para macOS ainda não são publicadas.',
        win_exe: { label: 'Instalador (.exe)', hint: 'Recomendado para Windows 10/11' },
        win_msi: { label: 'Pacote (.msi)', hint: 'Para instalação gerenciada / silenciosa' },
        appimage: { label: 'AppImage', hint: 'Roda em qualquer lugar — sem instalar' },
        deb: { label: 'Debian (.deb)', hint: 'Debian, Ubuntu, Mint' },
        rpm: { label: 'Fedora (.rpm)', hint: 'Fedora, RHEL, openSUSE' },
        pacman: { label: 'Arch (.pacman)', hint: 'Arch, Manjaro' },
    },
    footer: { license: '— licença MIT', source: 'Código', releases: 'Releases', issues: 'Issues', changelog: 'Changelog' },
    common: { back_to_top: 'Voltar ao topo', language: 'Idioma' },
};

const es: Messages = {
    nav: { features: 'Funciones', screenshots: 'Pantallas', github: 'GitHub', download: 'Descargar' },
    hero: {
        badge_version: '{version} ya está disponible — proyectos, historial más rápido y más',
        badge_generic: 'Ahora con proyectos, historial más rápido y más',
        title_1: 'Un cliente Git que sigue',
        title_2: 'tu ritmo',
        subtitle: 'GitBox habla con Git mediante un addon nativo sobre libgit2, sin lanzar procesos externos — así el historial, los diffs y el cambio de rama responden al instante, incluso en repositorios con miles de commits.',
        cta_download: 'Descargar gratis',
        cta_source: 'Ver el código',
        note: 'Windows y Linux · Licencia MIT · Sin cuenta',
        shot_alt: 'GitBox mostrando el grafo de commits de un repositorio',
    },
    features: {
        eyebrow: 'Funciones',
        title: 'Todo lo que usas, nada que estorbe',
        subtitle: 'GitBox está construido alrededor de las operaciones que repites decenas de veces al día, y se aparta en las demás.',
        speed: { title: 'Velocidad nativa', body: 'Git corre por un addon C++ hecho a medida sobre libgit2 — enlazado estáticamente, sin depender del git del sistema. Repositorios con miles de commits abren al instante.' },
        history: { title: 'Historial visual', body: 'Un grafo de commits de verdad, con marcas de merge, etiquetas y ramas, virtualizado para desplazarse con fluidez por muy profundo que sea el historial.' },
        projects: { title: 'Proyectos', body: 'Agrupa los repositorios en proyectos con color propio. Cambiar de contexto cambia toda la barra de pestañas — un clic en lugar de reabrirlo todo.' },
        diffs: { title: 'Diffs con Monaco', body: 'Diffs en paralelo y en línea con el editor detrás de VS Code, con vistas de imagen, markdown y cinta para lo que no es texto plano.' },
        conflicts: { title: 'Editor de conflictos', body: 'Los conflictos de merge se abren en un editor dedicado de tres paneles, con acciones por bloque, para resolverlos donde ya estás.' },
        terminal: { title: 'Terminal integrada', body: 'Una sesión de terminal completa (xterm.js + node-pty) acoplada al espacio de trabajo, para cuando la interfaz debe apartarse.' },
        themes: { title: 'Personalizable', body: 'Cada color es un design token. Edita un tema en la app o instala uno del registro de la comunidad — la paleta del grafo lo sigue.' },
        keyboard: { title: 'Pensado para el teclado', body: 'Atajos globales para pestañas, proyectos, terminal y ajustes, listados en una hoja con búsqueda y traducidos a todos los idiomas.' },
        tags: { title: 'Tags y ramas', body: 'Crea, cambia y elimina ramas y tags desde la barra lateral, y velas todas dibujadas en el propio grafo de commits.' },
        prs: { title: 'Pull requests', body: 'Explora y abre los pull requests del repositorio en el que estás, y crea uno nuevo desde la rama actual.' },
        submodules: { title: 'Submódulos', body: 'Añade, sincroniza y actualiza repositorios anidados, y abre un submódulo como pestaña propia cuando necesites trabajar dentro.' },
        stashes: { title: 'Stashes', body: 'Guarda cambios con o sin archivos sin seguimiento, lee el contenido de cada stash y aplícalo o descártalo sin tocar la terminal.' },
    },
    gallery: {
        eyebrow: 'Por dentro',
        title: 'Hecho para sesiones largas',
        subtitle: 'Nueve pantallas en las que realmente vas a vivir — no una maqueta de landing.',
        prev: 'Pantalla anterior',
        next: 'Pantalla siguiente',
        history: { label: 'Historial', title: 'El grafo de commits, bien dibujado', caption: 'Etiquetas de rama, tags y marcas de merge en una lista virtualizada que sigue fluida con miles de commits.' },
        changes: { label: 'Cambios locales', title: 'Preparar, revisar, confirmar', caption: 'El árbol de lo que cambió con el diff al lado, y la caja de commit siempre a mano.' },
        conflicts: { label: 'Conflictos', title: 'Decide un conflicto sin salir de la app', caption: 'Ambos lados aparecen con su rama y su commit, así puedes quedarte con uno — o abrir el editor.' },
        merge: { label: 'Editor de merge', title: 'Un editor de merge de tres paneles de verdad', caption: 'Actual, resultado y entrante en paralelo, con acciones por bloque y la cuenta de lo que falta.' },
        projects: { label: 'Proyectos', title: 'Agrupa repositorios en proyectos', caption: 'Cada proyecto guarda sus pestañas y su color; cambiar cambia toda la barra de un clic.' },
        stashes: { label: 'Stashes', title: 'Stashes que se pueden leer', caption: 'Cada stash con su rama, fecha y contenido, a un clic de aplicarse o descartarse.' },
        statistics: { label: 'Estadísticas', title: 'Conoce tu repositorio', caption: 'Commits, contribuidores, ramas, tamaño y churn, con el reparto de contribución por persona.' },
        settings: { label: 'Ajustes', title: 'A tu medida', caption: 'Idioma, formato de fecha, sondeo, temas y herramientas externas — todo en un sitio.' },
        log: { label: 'Registro de comandos', title: 'Nada ocurre a tus espaldas', caption: 'Cada operación que ejecuta GitBox, con su salida y duración, para que siempre sepas qué hizo.' },
    },
    downloads: {
        eyebrow: 'Descarga',
        title: 'Consigue GitBox',
        subtitle: 'Libre y de código abierto. Las instalaciones se actualizan solas con el updater integrado, así que esta es la única descarga necesaria.',
        your_system: 'tu sistema',
        failed: 'No se pudo alcanzar la API de GitHub — seguimos intentando.',
        failed_hint: 'La página de releases de abajo siempre funciona; los botones se rellenan solos si la API responde.',
        open_release: 'Abrir la última release en GitHub',
        retry: 'Reintentar',
        older: '¿Buscas una versión anterior?',
        browse: 'Ver todas las releases',
        no_mac: 'Las builds para macOS aún no se publican.',
        win_exe: { label: 'Instalador (.exe)', hint: 'Recomendado para Windows 10/11' },
        win_msi: { label: 'Paquete (.msi)', hint: 'Para instalaciones gestionadas / silenciosas' },
        appimage: { label: 'AppImage', hint: 'Funciona en cualquier sitio — sin instalar' },
        deb: { label: 'Debian (.deb)', hint: 'Debian, Ubuntu, Mint' },
        rpm: { label: 'Fedora (.rpm)', hint: 'Fedora, RHEL, openSUSE' },
        pacman: { label: 'Arch (.pacman)', hint: 'Arch, Manjaro' },
    },
    footer: { license: '— licencia MIT', source: 'Código', releases: 'Releases', issues: 'Issues', changelog: 'Changelog' },
    common: { back_to_top: 'Volver arriba', language: 'Idioma' },
};

const MESSAGES: Record<LocaleCode, Messages> = { en, 'pt-br': ptBr, es };

function detect(): LocaleCode {
    const saved = localStorage.getItem(STORAGE_KEY) as LocaleCode | null;
    if (saved && MESSAGES[saved]) return saved;

    const nav = (navigator.language || 'en').toLowerCase();
    if (nav.startsWith('pt')) return 'pt-br';
    if (nav.startsWith('es')) return 'es';
    return 'en';
}

export const locale = ref<LocaleCode>(detect());

export function setLocale(code: LocaleCode) {
    locale.value = code;
    localStorage.setItem(STORAGE_KEY, code);
    document.documentElement.lang = code;
}

/** Resolves a dotted key, falling back to English and then to the key itself. */
export function translate(key: string, locales: Messages, fallback: Messages): string {
    const walk = (src: Messages) => key.split('.').reduce<any>((acc, part) => (acc == null ? acc : acc[part]), src);
    const hit = walk(locales) ?? walk(fallback);
    return typeof hit === 'string' ? hit : key;
}

export function useI18n() {
    const messages = computed(() => MESSAGES[locale.value] || en);

    function t(key: string, vars?: Record<string, string>): string {
        let out = translate(key, messages.value, en);
        if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, v);
        return out;
    }

    return { t, locale, setLocale, locales: LOCALES };
}
