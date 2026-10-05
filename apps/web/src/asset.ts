/** Путь к файлу из public/ с учётом базового пути сайта (Pages живёт под /archipelago/). */
export const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, '');
