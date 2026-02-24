<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "../components/AppButton.vue";
import getCookie from "../utils/getCookies";
import { usersManager, type User } from "../utils/JsonManager";

/**
 * Durée d'attente avant d'autoriser la confirmation de suppression.
 */
const DELETE_CONFIRM_DELAY_MS = 5000;

/**
 * Fréquence de mise à jour de l'indicateur de progression.
 */
const DELETE_PROGRESS_TICK_MS = 100;

/**
 * Liste des utilisateurs disponibles dans le stockage local.
 */
const users = ref<User[]>([]);

/**
 * États d'interface globaux.
 */
const loading = ref<boolean>(true);
const saving = ref<boolean>(false);
const errorMessage = ref<string>("");
const successMessage = ref<string>("");

const router = useRouter();

/**
 * Identifiant de l'utilisateur connecté.
 */
const connectedUserId = ref<number | null>(null);

/**
 * État du formulaire profil.
 */
const formState = reactive({
    name: "",
    email: "",
    password: "",
    created_at: "",
    first_name: "",
    last_name: "",
    ammount: 0,
});

/**
 * État d'affichage du mot de passe dans le formulaire.
 */
const showPassword = ref<boolean>(false);

/**
 * États liés à la suppression sécurisée.
 */
const showDeletePopover = ref<boolean>(false);
const deleteCountdownRemainingMs = ref<number>(DELETE_CONFIRM_DELAY_MS);
let deleteTimer: ReturnType<typeof setInterval> | null = null;

const hasSelectedUser = computed<boolean>(() => connectedUserId.value !== null);

const canConfirmDelete = computed<boolean>(() => deleteCountdownRemainingMs.value <= 0);

const deleteProgressPercent = computed<number>(() => {
    const elapsedMs = DELETE_CONFIRM_DELAY_MS - deleteCountdownRemainingMs.value;
    return Math.min(100, Math.max(0, (elapsedMs / DELETE_CONFIRM_DELAY_MS) * 100));
});

const selectedUserLabel = computed<string>(() => {
    if (connectedUserId.value === null) {
        return "aucun utilisateur";
    }

    const user = users.value.find((item) => item.id === connectedUserId.value);
    return user ? `${user.first_name} ${user.last_name}`.trim() || user.name : "utilisateur introuvable";
});

/**
 * Évalue le niveau de robustesse du mot de passe courant.
 */
const passwordStrength = computed<{
    score: number;
    label: string;
    colorClass: string;
}>(() => {
    const password = formState.password;

    if (!password) {
        return {
            score: 0,
            label: "Aucun mot de passe",
            colorClass: "bg-gray-300",
        };
    }

    let score = 0;

    if (password.length >= 8) {
        score += 25;
    }
    if (/[A-Z]/.test(password)) {
        score += 25;
    }
    if (/[0-9]/.test(password)) {
        score += 25;
    }
    if (/[^A-Za-z0-9]/.test(password)) {
        score += 25;
    }

    if (score <= 25) {
        return {
            score,
            label: "Faible",
            colorClass: "bg-red-500",
        };
    }

    if (score <= 50) {
        return {
            score,
            label: "Moyen",
            colorClass: "bg-orange-500",
        };
    }

    if (score <= 75) {
        return {
            score,
            label: "Bon",
            colorClass: "bg-yellow-500",
        };
    }

    return {
        score,
        label: "Très bon",
        colorClass: "bg-green-600",
    };
});

/**
 * Charge les utilisateurs et initialise la sélection.
 */
const loadUsers = async (): Promise<void> => {
    loading.value = true;
    errorMessage.value = "";

    try {
        await usersManager.init();
        users.value = usersManager.getAll();

        const userIdCookie = getCookie("user_id");
        const parsedUserId = userIdCookie ? Number.parseInt(userIdCookie, 10) : Number.NaN;

        if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
            connectedUserId.value = null;
            errorMessage.value = "Aucun utilisateur connecté. Veuillez vous reconnecter.";
            return;
        }

        const connectedUser = users.value.find((item) => item.id === parsedUserId);
        if (!connectedUser) {
            connectedUserId.value = null;
            errorMessage.value = "Utilisateur connecté introuvable. Veuillez vous reconnecter.";
            return;
        }

        connectedUserId.value = connectedUser.id;
    } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : "Erreur inattendue pendant le chargement des utilisateurs.";
    } finally {
        loading.value = false;
    }
};

/**
 * Synchronise les champs du formulaire avec l'utilisateur sélectionné.
 */
const syncFormWithSelection = (): void => {
    successMessage.value = "";

    if (connectedUserId.value === null) {
        formState.name = "";
        formState.email = "";
        formState.password = "";
        formState.created_at = "";
        formState.first_name = "";
        formState.last_name = "";
        formState.ammount = 0;
        return;
    }

    const user = users.value.find((item) => item.id === connectedUserId.value);
    if (!user) {
        errorMessage.value = "L'utilisateur sélectionné est introuvable.";
        return;
    }

    formState.name = user.name;
    formState.email = user.email;
    formState.password = user.password;
    formState.created_at = user.created_at;
    formState.first_name = user.first_name;
    formState.last_name = user.last_name;
    formState.ammount = user.ammount;
};

/**
 * Sauvegarde les modifications de l'utilisateur courant.
 */
const saveUser = (): void => {
    if (connectedUserId.value === null) {
        errorMessage.value = "Aucun utilisateur connecté.";
        return;
    }

    const payload: Omit<User, "id"> = {
        name: formState.name.trim(),
        email: formState.email.trim(),
        password: formState.password,
        created_at: formState.created_at,
        first_name: formState.first_name.trim(),
        last_name: formState.last_name.trim(),
        ammount: Number(formState.ammount),
    };

    if (!payload.name || !payload.email) {
        errorMessage.value = "Les champs nom et email sont obligatoires.";
        return;
    }

    saving.value = true;
    errorMessage.value = "";

    const updated = usersManager.update(connectedUserId.value, payload);
    if (!updated) {
        errorMessage.value = "Impossible de sauvegarder: utilisateur introuvable.";
        saving.value = false;
        return;
    }

    users.value = usersManager.getAll();
    successMessage.value = "Profil sauvegardé avec succès.";
    saving.value = false;
};

/**
 * Bascule l'affichage du champ mot de passe.
 */
const togglePasswordVisibility = (): void => {
    showPassword.value = !showPassword.value;
};

/**
 * Ouvre la fenêtre de validation de suppression et démarre le compteur de sécurité.
 */
const openDeletePopover = (): void => {
    if (connectedUserId.value === null) {
        errorMessage.value = "Aucun utilisateur connecté.";
        return;
    }

    showDeletePopover.value = true;
    startDeleteCountdown();
};

/**
 * Ferme la fenêtre de validation de suppression.
 */
const closeDeletePopover = (): void => {
    showDeletePopover.value = false;
    stopDeleteCountdown();
    deleteCountdownRemainingMs.value = DELETE_CONFIRM_DELAY_MS;
};

/**
 * Démarre le décompte de 5 secondes avant activation du bouton de confirmation.
 */
const startDeleteCountdown = (): void => {
    stopDeleteCountdown();
    deleteCountdownRemainingMs.value = DELETE_CONFIRM_DELAY_MS;

    deleteTimer = setInterval(() => {
        const nextValue = deleteCountdownRemainingMs.value - DELETE_PROGRESS_TICK_MS;
        deleteCountdownRemainingMs.value = nextValue > 0 ? nextValue : 0;

        if (deleteCountdownRemainingMs.value === 0) {
            stopDeleteCountdown();
        }
    }, DELETE_PROGRESS_TICK_MS);
};

/**
 * Arrête le timer de décompte s'il est actif.
 */
const stopDeleteCountdown = (): void => {
    if (deleteTimer !== null) {
        clearInterval(deleteTimer);
        deleteTimer = null;
    }
};

/**
 * Confirme la suppression de l'utilisateur sélectionné.
 */
const confirmDeleteUser = (): void => {
    if (connectedUserId.value === null || !canConfirmDelete.value) {
        return;
    }

    const deleted = usersManager.delete(connectedUserId.value);
    if (!deleted) {
        errorMessage.value = "La suppression a échoué: utilisateur introuvable.";
        closeDeletePopover();
        return;
    }

    users.value = usersManager.getAll();
    connectedUserId.value = null;
    syncFormWithSelection();
    document.cookie = "user_id=; Max-Age=0; path=/;";

    successMessage.value = "Utilisateur supprimé.";
    errorMessage.value = "";
    closeDeletePopover();
    router.push("/login");
};

onMounted(async () => {
    await loadUsers();
    syncFormWithSelection();
});

onUnmounted(() => {
    stopDeleteCountdown();
});
</script>

<template>
    <section class="p-6 space-y-6">
        <h1 class="text-2xl font-semibold">Gestion du profil utilisateur</h1>

        <p v-if="errorMessage" class="text-sm text-red-600">
            {{ errorMessage }}
        </p>
        <p v-if="successMessage" class="text-sm text-green-700">
            {{ successMessage }}
        </p>

        <div v-if="loading" class="text-sm">Chargement des utilisateurs...</div>

        <template v-else>

            <form class="space-y-3" @submit.prevent="saveUser">
                <div class="grid gap-3 md:grid-cols-2">
                    <label class="flex flex-col gap-1">
                        <span class="text-sm">Nom affiché</span>
                        <input v-model="formState.name" type="text" class="rounded border px-3 py-2" :disabled="!hasSelectedUser" />
                    </label>

                    <label class="flex flex-col gap-1">
                        <span class="text-sm">Email</span>
                        <input
                            v-model="formState.email"
                            type="email"
                            class="rounded border px-3 py-2"
                            :disabled="!hasSelectedUser"
                        />
                    </label>

                    <label class="flex flex-col gap-1">
                        <span class="text-sm">Mot de passe</span>
                        <div class="relative">
                            <input
                                v-model="formState.password"
                                :type="showPassword ? 'text' : 'password'"
                                class="w-full rounded border px-3 py-2 pr-11"
                                :disabled="!hasSelectedUser"
                            />
                            <button
                                type="button"
                                class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                                :disabled="!hasSelectedUser"
                                :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                                @click="togglePasswordVisibility"
                            >
                                <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-5 w-5" stroke="currentColor" stroke-width="1.8">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12Z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                                <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-5 w-5" stroke="currentColor" stroke-width="1.8">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18" />
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.88 5.09A10.94 10.94 0 0 1 12 4.5c6 0 9.75 7.5 9.75 7.5a17.62 17.62 0 0 1-3.34 4.28M6.1 6.1A17.73 17.73 0 0 0 2.25 12s3.75 7.5 9.75 7.5a10.88 10.88 0 0 0 4.02-.75" />
                                </svg>
                            </button>
                        </div>
                        <div class="space-y-1">
                            <div class="h-2 w-full rounded bg-gray-200 overflow-hidden">
                                <div
                                    class="h-full transition-all"
                                    :class="passwordStrength.colorClass"
                                    :style="{ width: `${passwordStrength.score}%` }"
                                />
                            </div>
                            <p class="text-xs text-gray-600">Niveau du mot de passe: {{ passwordStrength.label }}</p>
                        </div>
                    </label>


                    <label class="flex flex-col gap-1">
                        <span class="text-sm">Prénom</span>
                        <input
                            v-model="formState.first_name"
                            type="text"
                            class="rounded border px-3 py-2"
                            :disabled="!hasSelectedUser"
                        />
                    </label>

                    <label class="flex flex-col gap-1">
                        <span class="text-sm">Nom</span>
                        <input
                            v-model="formState.last_name"
                            type="text"
                            class="rounded border px-3 py-2"
                            :disabled="!hasSelectedUser"
                        />
                    </label>

                    <label class="flex flex-col gap-1 md:col-span-2">
                        <span class="text-sm">Montant actuel</span>
                        <input
                            v-model.number="formState.ammount"
                            type="number"
                            step="0.01"
                            class="rounded border px-3 py-2"
                            :disabled="!hasSelectedUser"
                        />
                    </label>
                </div>

                <div class="flex gap-2">
                    <AppButton type="submit" :disabled="!hasSelectedUser || saving">Sauvegarder</AppButton>
                    <AppButton type="button" variant="danger" :disabled="!hasSelectedUser" @click="openDeletePopover">
                        Supprimer l'utilisateur
                    </AppButton>
                </div>
            </form>

            <div
                v-if="showDeletePopover"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
                @click.self="closeDeletePopover"
            >
                <div class="w-full max-w-md rounded border bg-white p-4 space-y-4">
                    <h2 class="text-lg font-semibold">Confirmer la suppression</h2>
                    <p class="text-sm text-gray-700">
                        Vous êtes sur le point de supprimer <strong>{{ selectedUserLabel }}</strong>. Cette action est irréversible.
                    </p>

                    <div class="flex items-center gap-3">
                        <div
                            class="h-10 w-10 rounded-full border"
                            :style="{
                                background: `conic-gradient(#ef4444 ${deleteProgressPercent}%, #e5e7eb ${deleteProgressPercent}% 100%)`,
                            }"
                            aria-hidden="true"
                        />
                        <span class="text-sm text-gray-700">
                            Confirmation disponible dans {{ Math.ceil(deleteCountdownRemainingMs / 1000) }}s
                        </span>
                    </div>

                    <div class="flex justify-end gap-2">
                        <AppButton type="button" @click="closeDeletePopover">Annuler</AppButton>
                        <AppButton
                            type="button"
                            variant="danger"
                            :disabled="!canConfirmDelete"
                            @click="confirmDeleteUser"
                        >
                            Confirmer
                        </AppButton>
                    </div>
                </div>
            </div>
        </template>
    </section>
</template>

<style scoped></style>