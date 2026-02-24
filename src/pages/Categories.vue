<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import AppButton from "../components/AppButton.vue";
import { categoriesManager, type Category } from "../utils/JsonManager";
import getCookie from "../utils/getCookies";

type CategoryWithUser = Category & {
    userId: number;
};

/**
 * État principal de la vue.
 *
 * Les données sont chargées depuis le JsonManager puis affichées dans la liste.
 */
const categories = ref<CategoryWithUser[]>([]);
const loading = ref<boolean>(true);
const errorMessage = ref<string>("");
const connectedUserId = ref<number | null>(null);

/**
 * État du formulaire pour la création et la modification.
 */
const formState = reactive({
    name: "",
    description: "",
});

const editingCategoryId = ref<number | null>(null);

const isEditing = computed<boolean>(() => editingCategoryId.value !== null);
const hasConnectedUser = computed<boolean>(() => connectedUserId.value !== null);

const refreshCategoriesForConnectedUser = (): void => {
    const allCategories = categoriesManager.getAll() as CategoryWithUser[];
    categories.value = connectedUserId.value === null
        ? []
        : allCategories.filter((category) => category.userId === connectedUserId.value);
};

/**
 * Charge les catégories depuis la source du manager.
 */
const loadCategories = async (): Promise<void> => {
    loading.value = true;
    errorMessage.value = "";

    try {
        await categoriesManager.init();

        const userIdCookie = getCookie("user_id");
        const parsedUserId = userIdCookie ? Number.parseInt(userIdCookie, 10) : Number.NaN;

        if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
            connectedUserId.value = null;
            categories.value = [];
            errorMessage.value = "Aucun utilisateur connecté. Veuillez vous reconnecter.";
            return;
        }

        connectedUserId.value = parsedUserId;
        refreshCategoriesForConnectedUser();
    } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : "Erreur inattendue pendant le chargement des catégories.";
    } finally {
        loading.value = false;
    }
};

/**
 * Réinitialise les champs du formulaire et l'état d'édition.
 */
const resetForm = (): void => {
    formState.name = "";
    formState.description = "";
    editingCategoryId.value = null;
};

/**
 * Crée une catégorie ou met à jour la catégorie en cours d'édition.
 */
const submitForm = (): void => {
    if (connectedUserId.value === null) {
        errorMessage.value = "Aucun utilisateur connecté.";
        return;
    }

    const name = formState.name.trim();
    const description = formState.description.trim();

    if (!name) {
        errorMessage.value = "Le nom de la catégorie est obligatoire.";
        return;
    }

    errorMessage.value = "";

    if (editingCategoryId.value === null) {
        categoriesManager.create({
            name,
            description,
            userId: connectedUserId.value,
        } as Omit<CategoryWithUser, "id">);
    } else {
        categoriesManager.update(editingCategoryId.value, {
            name,
            description,
        });
    }

    refreshCategoriesForConnectedUser();
    resetForm();
};

/**
 * Prépare le formulaire avec les données d'une catégorie existante.
 */
const startEdit = (category: Category): void => {
    editingCategoryId.value = category.id;
    formState.name = category.name;
    formState.description = category.description;
};

/**
 * Supprime une catégorie et rafraîchit la liste.
 */
const removeCategory = (id: number): void => {
    categoriesManager.delete(id);
    refreshCategoriesForConnectedUser();

    if (editingCategoryId.value === id) {
        resetForm();
    }
};

onMounted(async () => {
    await loadCategories();
});
</script>

<template>
    <section class="p-6 space-y-6">
        <h1 class="text-2xl font-semibold">Gestion des catégories</h1>

        <p v-if="errorMessage" class="text-sm text-red-600">
            {{ errorMessage }}
        </p>

        <form class="space-y-3" @submit.prevent="submitForm">
            <div class="grid gap-3 md:grid-cols-2">
                <label class="flex flex-col gap-1">
                    <span class="text-sm">Nom</span>
                    <input
                        v-model="formState.name"
                        type="text"
                        class="rounded border px-3 py-2"
                        placeholder="Nom de la catégorie"
                    />
                </label>

                <label class="flex flex-col gap-1">
                    <span class="text-sm">Description</span>
                    <input
                        v-model="formState.description"
                        type="text"
                        class="rounded border px-3 py-2"
                        placeholder="Description"
                    />
                </label>
            </div>

            <div class="flex gap-2">
                <AppButton type="submit">
                    {{ isEditing ? "Mettre à jour" : "Créer" }}
                </AppButton>
                <AppButton type="button" :disabled="!hasConnectedUser" @click="resetForm">
                    Annuler
                </AppButton>
            </div>
        </form>

        <div v-if="loading" class="text-sm">Chargement des catégories...</div>

        <ul v-else class="space-y-2">
            <li
                v-for="category in categories"
                :key="category.id"
                class="flex items-start justify-between rounded border p-3"
            >
                <div>
                    <p class="font-medium">{{ category.name }}</p>
                    <p class="text-sm text-gray-600">{{ category.description }}</p>
                </div>

                <div class="flex gap-2">
                    <AppButton type="button" size="sm" @click="startEdit(category)">
                        Modifier
                    </AppButton>
                    <AppButton type="button" size="sm" variant="danger" @click="removeCategory(category.id)">
                        Supprimer
                    </AppButton>
                </div>
            </li>
        </ul>
    </section>
</template>

<style scoped></style>
