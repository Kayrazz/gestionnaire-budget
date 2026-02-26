
import { defineStore } from "pinia";
import {
    categoriesManager,
    transactionsManager,
    usersManager,
    type User,
} from "../utils/JsonManager";

const AUTH_STORAGE_KEY = "budget-manager:auth-user";
const THEME_STORAGE_KEY = "budget-manager:theme";

type StoredAuthState = {
    userId: number;
};

type UserStoreState = {
    user: User | null;
    loggedIn: boolean;
    hydrated: boolean;
};

const parseStoredAuthState = (rawValue: string | null): StoredAuthState | null => {
    if (!rawValue) {
        return null;
    }

    try {
        const parsedValue = JSON.parse(rawValue) as Partial<StoredAuthState>;
        if (!Number.isInteger(parsedValue.userId) || parsedValue.userId === undefined || parsedValue.userId <= 0) {
            return null;
        }
        return { userId: parsedValue.userId };
    } catch {
        return null;
    }
};

/**
 * Store d'authentification global.
 *
 * Responsabilités:
 * - Authentifier l'utilisateur.
 * - Persister la session dans localStorage pour survivre à un rechargement navigateur.
 * - Conserver la compatibilité avec le cookie user_id utilisé ailleurs dans l'application.
 */
export const useUserStore = defineStore("user", {
    state: (): UserStoreState => ({
        user: null,
        loggedIn: false,
        hydrated: false,
    }),

    getters: {
        isAuthenticated: (state): boolean => state.loggedIn && state.user !== null,
        connectedUserId: (state): number | null => state.user?.id ?? null,
    },

    actions: {
        /**
         * Authentifie un utilisateur et initialise les gestionnaires métiers filtrés.
         */
        async login(email: string, password: string): Promise<boolean> {
            const currentTheme = localStorage.getItem(THEME_STORAGE_KEY);
            localStorage.clear();
            if (currentTheme) {
                localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
            }

            await usersManager.init();

            const user = usersManager
                .getAll()
                .find((item) => item.email === email && item.password === password);

            if (!user) {
                this.user = null;
                this.loggedIn = false;
                this.hydrated = true;
                return false;
            }

            await usersManager.init(user.id, true);
            await categoriesManager.init(user.id, true);
            await transactionsManager.init(user.id, true);

            this.user = user;
            this.loggedIn = true;
            this.hydrated = true;
            this.persistSession();

            return true;
        },

        /**
         * Restaure la session depuis localStorage au démarrage de l'application.
         */
        async restoreSession(): Promise<void> {
            if (this.hydrated) {
                return;
            }

            const storedState = parseStoredAuthState(localStorage.getItem(AUTH_STORAGE_KEY));
            if (!storedState) {
                this.clearSessionState();
                return;
            }

            await usersManager.init();
            const user = usersManager.getById(storedState.userId);

            if (!user) {
                this.clearSessionState();
                return;
            }

            await usersManager.init(user.id, true);
            await categoriesManager.init(user.id, true);
            await transactionsManager.init(user.id, true);

            this.user = user;
            this.loggedIn = true;
            this.hydrated = true;
            this.persistSession();
        },

        /**
         * Termine la session courante et nettoie les données locales.
         */
        logout(): void {
            const currentTheme = localStorage.getItem(THEME_STORAGE_KEY);
            localStorage.clear();
            if (currentTheme) {
                localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
            }

            this.clearSessionState();
        },

        /**
         * Synchronise les informations utilisateur courantes après une mise à jour profil.
         */
        refreshConnectedUser(nextUser: User): void {
            this.user = nextUser;
            this.loggedIn = true;
            this.persistSession();
        },

        persistSession(): void {
            if (!this.user) {
                this.clearSessionState();
                return;
            }

            const payload: StoredAuthState = { userId: this.user.id };
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
            document.cookie = `user_id=${this.user.id}; path=/;`;
        },

        clearSessionState(): void {
            this.user = null;
            this.loggedIn = false;
            this.hydrated = true;
            localStorage.removeItem(AUTH_STORAGE_KEY);
            document.cookie = "user_id=; Max-Age=0; path=/;";
        },
    },
});