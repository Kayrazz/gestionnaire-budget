/**
 * Représente une entité métier persistable.
 *
 * Le gestionnaire repose sur un identifiant numérique pour faciliter
 * la génération d'identifiants et les opérations CRUD.
 */
export interface EntityWithId {
    id: number;
}

/**
 * Forme attendue d'un document JSON de collection.
 *
 * Exemple: { categories: Category[] }
 */
export type JsonCollection<TItem, TCollectionKey extends string> = {
    [K in TCollectionKey]: TItem[];
};

/**
 * Configuration de création d'un gestionnaire JSON.
 */
export interface JsonManagerOptions<TItem extends EntityWithId, TCollectionKey extends string> {
    /**
     * Chemin public du fichier JSON source (ex: /categories.json).
     */
    sourcePath: string;
    /**
     * Clé de collection dans le fichier JSON (ex: categories).
     */
    collectionKey: TCollectionKey;
    /**
     * Clé de persistance locale. Si absente, une clé est générée.
     */
    storageKey?: string;
    /**
     * Générateur d'identifiant optionnel.
     */
    idGenerator?: (items: TItem[]) => number;
}

/**
 * Gestionnaire CRUD générique pour des collections JSON en front-end.
 *
 * Important:
 * - Le navigateur ne peut pas modifier les fichiers du dossier public à l'exécution.
 * - Le fichier JSON est donc utilisé comme source initiale (lecture seule).
 * - Les modifications (create, update, delete) sont persistées dans localStorage.
 */
export class JsonManager<TItem extends EntityWithId, TCollectionKey extends string> {
    private readonly sourcePath: string;
    private readonly collectionKey: TCollectionKey;
    private readonly storageKey: string;
    private readonly idGenerator: (items: TItem[]) => number;
    private items: TItem[] = [];
    private initialized = false;
    private currentUserId: number | null = null;

    public constructor(options: JsonManagerOptions<TItem, TCollectionKey>) {
        this.sourcePath = options.sourcePath;
        this.collectionKey = options.collectionKey;
        this.storageKey = options.storageKey ?? `json-manager:${this.collectionKey}`;
        this.idGenerator = options.idGenerator ?? this.defaultIdGenerator;
    }

    /**
     * Initialise le gestionnaire en chargeant les données persistées localement,
     * ou à défaut les données du fichier JSON source.
     *
     * Si userId est fourni, les données sont filtrées par utilisateur:
     * - Transactions: filtrées par user_id
     * - Catégories: filtrées par userId
     * - Utilisateurs: non filtrés (tous les utilisateurs restent accessibles)
     */
    public async init(userId?: number, forceReload = false): Promise<void> {
        if (this.initialized && !forceReload) {
            return;
        }

        this.currentUserId = userId ?? null;

        const storedItems = this.readFromLocalStorage();
        if (storedItems !== null && !forceReload) {
            this.items = storedItems;
            this.initialized = true;
            return;
        }

        this.items = await this.readFromSource();
        this.items = this.filterByUser(this.items);
        this.writeToLocalStorage();
        this.initialized = true;
    }

    /**
     * Retourne la liste complète des éléments.
     */
    public getAll(): TItem[] {
        this.ensureInitialized();
        return this.clone(this.items);
    }

    /**
     * Recherche un élément par identifiant.
     */
    public getById(id: number): TItem | null {
        this.ensureInitialized();
        const foundItem = this.items.find((item) => item.id === id);
        return foundItem ? this.clone(foundItem) : null;
    }

    /**
     * Crée un nouvel élément et le persiste localement.
     */
    public create(payload: Omit<TItem, "id"> & Partial<Pick<TItem, "id">>): TItem {
        this.ensureInitialized();

        const id = payload.id ?? this.idGenerator(this.items);
        const newItem = { ...payload, id } as TItem;

        this.items.push(newItem);
        this.writeToLocalStorage();
        return this.clone(newItem);
    }

    /**
     * Met à jour un élément existant.
     *
     * Retourne l'élément mis à jour, ou null si l'identifiant est introuvable.
     */
    public update(id: number, patch: Partial<Omit<TItem, "id">>): TItem | null {
        this.ensureInitialized();

        const index = this.items.findIndex((item) => item.id === id);
        if (index === -1) {
            return null;
        }

        const updatedItem = {
            ...this.items[index],
            ...patch,
            id,
        } as TItem;

        this.items[index] = updatedItem;
        this.writeToLocalStorage();
        return this.clone(updatedItem);
    }

    /**
     * Supprime un élément par identifiant.
     *
     * Retourne true si l'élément a été supprimé, sinon false.
     */
    public delete(id: number): boolean {
        this.ensureInitialized();

        const initialLength = this.items.length;
        this.items = this.items.filter((item) => item.id !== id);

        const hasBeenDeleted = this.items.length < initialLength;
        if (hasBeenDeleted) {
            this.writeToLocalStorage();
        }

        return hasBeenDeleted;
    }

    /**
     * Remplace l'ensemble de la collection puis persiste localement.
     */
    public replaceAll(nextItems: TItem[]): void {
        this.ensureInitialized();
        this.items = this.clone(nextItems);
        this.writeToLocalStorage();
    }

    /**
     * Réinitialise les données depuis la source JSON et met à jour le cache local.
     */
    public async resetFromSource(): Promise<void> {
        this.items = await this.readFromSource();
        this.writeToLocalStorage();
        this.initialized = true;
    }

    /**
     * Supprime uniquement la persistance locale.
     */
    public clearLocalStorage(): void {
        localStorage.removeItem(this.storageKey);
    }

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error(
                `JsonManager non initialisé pour la collection "${this.collectionKey}". Appelez init() avant d'utiliser les opérations CRUD.`,
            );
        }
    }

    private async readFromSource(): Promise<TItem[]> {
        const response = await fetch(this.sourcePath, {
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Impossible de charger ${this.sourcePath}: ${response.status} ${response.statusText}`);
        }

        const document = (await response.json()) as JsonCollection<TItem, TCollectionKey>;
        return this.clone(document[this.collectionKey] ?? []);
    }

    private readFromLocalStorage(): TItem[] | null {
        const rawValue = localStorage.getItem(this.storageKey);
        if (!rawValue) {
            return null;
        }

        try {
            const parsedValue = JSON.parse(rawValue) as TItem[];
            return Array.isArray(parsedValue) ? this.clone(parsedValue) : null;
        } catch {
            return null;
        }
    }

    private writeToLocalStorage(): void {
        localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    }

    private defaultIdGenerator = (items: TItem[]): number => {
        if (items.length === 0) {
            return 1;
        }

        const maxId = items.reduce((currentMax, item) => {
            return item.id > currentMax ? item.id : currentMax;
        }, 0);

        return maxId + 1;
    };

    private clone<TData>(value: TData): TData {
        return JSON.parse(JSON.stringify(value)) as TData;
    }

    private filterByUser(items: TItem[]): TItem[] {
        if (!this.currentUserId) {
            return items;
        }

        // Filtrer les transactions par user_id
        const isTransaction = (item: unknown): item is Transaction => {
            const maybeTransaction = item as Record<string, unknown>;
            return "user_id" in maybeTransaction && typeof maybeTransaction.user_id === "number";
        };

        // Filtrer les catégories par userId
        const isCategory = (item: unknown): item is Category => {
            const maybeCategory = item as Record<string, unknown>;
            return "name" in maybeCategory && "description" in maybeCategory;
        };

        // Filtrer les utilisateurs par id
        const isUser = (item: unknown): item is User => {
            const maybeUser = item as Record<string, unknown>;
            return "email" in maybeUser && "password" in maybeUser && "created_at" in maybeUser;
        };

        return items.filter((item) => {
            if (isTransaction(item)) {
                return item.user_id === this.currentUserId;
            }
            if (isCategory(item)) {
                return item.userId === undefined || item.userId === this.currentUserId;
            }
            if (isUser(item)) {
                return item.id === this.currentUserId;
            }
            // Par défaut, ne pas filtrer
            return true;
        }) as TItem[];
    }
}

export interface Category extends EntityWithId {
    name: string;
    description: string;
    userId: number;
}

export interface Transaction extends EntityWithId {
    date: string;
    amount: number;
    nom: string;
    description: string;
    categories: number[];
    status: string;
    link: number[];
    user_id: number;
}

export interface User extends EntityWithId {
    name: string;
    email: string;
    password: string;
    created_at: string;
    first_name: string;
    last_name: string;
    ammount: number;
}

export const categoriesManager = new JsonManager<Category, "categories">({
    sourcePath: "/categories.json",
    collectionKey: "categories",
    storageKey: "budget-manager:categories",
});

export const transactionsManager = new JsonManager<Transaction, "transactions">({
    sourcePath: "/transaction.json",
    collectionKey: "transactions",
    storageKey: "budget-manager:transactions",
});

export const usersManager = new JsonManager<User, "users">({
    sourcePath: "/user.json",
    collectionKey: "users",
    storageKey: "budget-manager:users",
});
