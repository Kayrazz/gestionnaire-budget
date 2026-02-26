<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import getCookie from "../utils/getCookies";
import {
    categoriesManager,
    rulesManager,
    transactionsManager,
    type Category,
    type Rule,
} from "../utils/JsonManager";
import {
    doesRuleMatchTransaction,
    formatRulePatternForInput,
    getRuleCategoryIds,
    normalizeRulePatternForStorage,
} from "../utils/ruleMatching";
import AppButton from "../components/AppButton.vue";
import AppToast from "../components/AppToast.vue";

type ToastType = "success" | "info" | "alert";

interface RuleFormState {
    id: number | null;
    categoriesId: number | null;
    description: string;
    transactionNameRegex: string;
    transactionDescriptionRegex: string;
}

const rules = ref<Rule[]>([]);
const categories = ref<Category[]>([]);
const currentUserId = ref<number | null>(null);
const selectedRuleId = ref<number | null>(null);
const isEditing = ref(false);
const showDeletePopover = ref(false);

const toastVisible = ref(false);
const toastMessage = ref("");
const toastType = ref<ToastType>("info");

const createInitialFormState = (): RuleFormState => ({
    id: null,
    categoriesId: null,
    description: "",
    transactionNameRegex: "",
    transactionDescriptionRegex: "",
});

const formState = ref<RuleFormState>(createInitialFormState());

const showToast = (message: string, type: ToastType = "info"): void => {
    toastVisible.value = false;
    toastMessage.value = message;
    toastType.value = type;

    requestAnimationFrame(() => {
        toastVisible.value = true;
    });
};

const selectedRule = computed<Rule | null>(() => {
    if (selectedRuleId.value === null) {
        return null;
    }

    return rules.value.find((rule: Rule) => rule.id === selectedRuleId.value) ?? null;
});

const selectedCategoryLabel = computed<string>(() => {
    if (!selectedRule.value) {
        return "";
    }

    const category = categories.value.find((item: Category) => item.id === selectedRule.value?.categoriesId);
    return category?.name ?? "Catégorie introuvable";
});

const sortedRules = computed<Rule[]>(() => {
    return [...rules.value].sort((left: Rule, right: Rule) => left.id - right.id);
});

const toUserFriendlyPattern = (value: string): string => {
    return formatRulePatternForInput(value);
};

const loadData = async (): Promise<void> => {
    const userIdCookie = getCookie("user_id");
    const parsedUserId = userIdCookie ? Number.parseInt(userIdCookie, 10) : Number.NaN;

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        showToast("Utilisateur non connecté. Veuillez vous reconnecter.", "alert");
        return;
    }

    currentUserId.value = parsedUserId;

    await categoriesManager.init(parsedUserId);
    await rulesManager.init(parsedUserId);
    await transactionsManager.init(parsedUserId);

    categories.value = categoriesManager.getAll();
    rules.value = rulesManager.getAll();
};

const resetForm = (): void => {
    formState.value = createInitialFormState();
    isEditing.value = false;
};

const openCreateForm = (): void => {
    resetForm();
    isEditing.value = true;
};

const openEditForm = (): void => {
    if (!selectedRule.value) {
        return;
    }

    formState.value = {
        id: selectedRule.value.id,
        categoriesId: selectedRule.value.categoriesId,
        description: selectedRule.value.description,
        transactionNameRegex: formatRulePatternForInput(selectedRule.value.transactionNameRegex),
        transactionDescriptionRegex: formatRulePatternForInput(selectedRule.value.transactionDescriptionRegex),
    };

    isEditing.value = true;
};

const selectRule = (ruleId: number): void => {
    selectedRuleId.value = selectedRuleId.value === ruleId ? null : ruleId;
};

const saveRule = (): void => {
    if (!currentUserId.value) {
        showToast("Utilisateur non connecté.", "alert");
        return;
    }

    if (!formState.value.categoriesId) {
        showToast("La catégorie associée est obligatoire.", "alert");
        return;
    }

    if (!formState.value.description.trim()) {
        showToast("La description de la règle est obligatoire.", "alert");
        return;
    }

    const hasNameRegex = formState.value.transactionNameRegex.trim().length > 0;
    const hasDescriptionRegex = formState.value.transactionDescriptionRegex.trim().length > 0;

    if (!hasNameRegex && !hasDescriptionRegex) {
        showToast("Renseignez au moins un motif sur le nom ou la description.", "alert");
        return;
    }

    const payload: Omit<Rule, "id"> = {
        categoriesId: formState.value.categoriesId,
        description: formState.value.description.trim(),
        transactionNameRegex: normalizeRulePatternForStorage(formState.value.transactionNameRegex),
        transactionDescriptionRegex: normalizeRulePatternForStorage(formState.value.transactionDescriptionRegex),
        userId: currentUserId.value,
    };

    if (formState.value.id !== null) {
        const updated = rulesManager.update(formState.value.id, payload);
        if (!updated) {
            showToast("Impossible de modifier la règle sélectionnée.", "alert");
            return;
        }

        showToast("Règle modifiée avec succès.", "success");
    } else {
        rulesManager.create(payload);
        showToast("Règle créée avec succès.", "success");
    }

    rules.value = rulesManager.getAll();
    resetForm();
};

const executeSelectedRule = (): void => {
    if (!selectedRule.value) {
        showToast("Sélectionnez une règle avant exécution.", "info");
        return;
    }

    const categoryIds = getRuleCategoryIds(selectedRule.value);
    if (categoryIds.length === 0) {
        showToast("La règle ne contient pas de catégorie valide.", "alert");
        return;
    }

    const transactions = transactionsManager.getAll();
    let updatedCount = 0;

    transactions.forEach((transaction) => {
        if (!doesRuleMatchTransaction(selectedRule.value as Rule, transaction)) {
            return;
        }

        const updated = transactionsManager.update(transaction.id, {
            categories: categoryIds,
        });

        if (updated) {
            updatedCount += 1;
        }
    });

    if (updatedCount === 0) {
        showToast("Aucune transaction existante ne correspond à cette règle.", "info");
        return;
    }

    showToast(`${updatedCount} transaction(s) mise(s) à jour avec la règle sélectionnée.`, "success");
};

const openDeleteConfirmation = (): void => {
    if (!selectedRule.value) {
        return;
    }

    showDeletePopover.value = true;
};

const closeDeleteConfirmation = (): void => {
    showDeletePopover.value = false;
};

const confirmDeleteRule = (): void => {
    if (!selectedRule.value) {
        closeDeleteConfirmation();
        return;
    }

    const deleted = rulesManager.delete(selectedRule.value.id);
    if (!deleted) {
        showToast("Suppression impossible: règle introuvable.", "alert");
        closeDeleteConfirmation();
        return;
    }

    rules.value = rulesManager.getAll();
    selectedRuleId.value = null;
    closeDeleteConfirmation();
    showToast("Règle supprimée avec succès.", "success");
};

const cancelEdit = (): void => {
    resetForm();
};

onMounted(() => {
    void loadData();
});
</script>

<template>
    <div class="transactions">
        <AppToast v-model="toastVisible" :message="toastMessage" :type="toastType" />

        <div class="transactions-header">
            <h1>Règles d'import</h1>
            <div class="header-actions">
                <AppButton @click="openCreateForm">Nouvelle règle</AppButton>
            </div>
        </div>

        <div class="actions-bar">
            <div class="group-controls">
                <AppButton size="sm" variant="surface" @click="openEditForm" :disabled="!selectedRule">
                    Modifier
                </AppButton>
                <AppButton size="sm" variant="surface" @click="executeSelectedRule" :disabled="!selectedRule">
                    Exécuter sur l'historique
                </AppButton>
                <AppButton size="sm" variant="danger" @click="openDeleteConfirmation" :disabled="!selectedRule">
                    Supprimer
                </AppButton>
            </div>
            <span class="total-amount">{{ selectedRule ? `Règle #${selectedRule.id}` : "Aucune règle sélectionnée" }}</span>
        </div>

        <div v-if="isEditing" class="form-section">
            <h2>{{ formState.id !== null ? "Modifier" : "Ajouter" }} une règle</h2>
            <form class="transaction-form" @submit.prevent="saveRule">
                <div class="form-group">
                    <label for="rule-description">Description</label>
                    <input
                        id="rule-description"
                        v-model="formState.description"
                        type="text"
                        placeholder="ex: Alimentation courante"
                        class="form-input"
                        required
                    />
                </div>

                <div class="form-group">
                    <label for="rule-category">Catégorie associée</label>
                    <select id="rule-category" v-model.number="formState.categoriesId" class="form-input" required>
                        <option :value="null" disabled>Sélectionnez une catégorie</option>
                        <option v-for="category in categories" :key="category.id" :value="category.id">
                            {{ category.name }}
                        </option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="rule-name-regex">Motif à trouver dans le nom</label>
                    <input
                        id="rule-name-regex"
                        v-model="formState.transactionNameRegex"
                        type="text"
                        placeholder="ex: supermarché | restaurant | épicerie"
                        class="form-input"
                    />
                </div>

                <div class="form-group">
                    <label for="rule-description-regex">Motif à trouver dans la description</label>
                    <input
                        id="rule-description-regex"
                        v-model="formState.transactionDescriptionRegex"
                        type="text"
                        placeholder="ex: facture | abonnement"
                        class="form-input"
                    />
                </div>

                <p class="form-hint">
                    Saisissez des mots-clés séparés par <strong>|</strong>, <strong>,</strong> ou <strong>;</strong>.
                    Exemple: <em>supermarché | restaurant | café</em>.
                </p>

                <div class="form-actions">
                    <AppButton type="submit">Enregistrer</AppButton>
                    <AppButton type="button" variant="danger" @click="cancelEdit">Annuler</AppButton>
                </div>
            </form>
        </div>

        <div class="transactions-list">
            <div v-if="sortedRules.length === 0" class="empty-state">
                <p>Aucune règle disponible</p>
            </div>

            <div v-else class="transactions-grid">
                <div
                    v-for="rule in sortedRules"
                    :key="rule.id"
                    class="transaction-row"
                    :class="{ 'selected-row': selectedRuleId === rule.id }"
                    @click="selectRule(rule.id)"
                >
                    <div class="transaction-info">
                        <div class="transaction-main">
                            <span class="node-badge">Règle {{ rule.id }}</span>
                            <p class="transaction-name-compact">{{ rule.description }}</p>
                            <span class="transaction-description-compact">
                                Nom: {{ toUserFriendlyPattern(rule.transactionNameRegex) || "-" }} • Description:
                                {{ toUserFriendlyPattern(rule.transactionDescriptionRegex) || "-" }}
                            </span>
                        </div>
                    </div>

                    <div class="transaction-secondary">
                        <span class="transaction-status-compact">{{ categories.find((item) => item.id === rule.categoriesId)?.name || "Catégorie introuvable" }}</span>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="selectedRule" class="selected-rule-panel">
            <strong>Détail de la règle sélectionnée</strong>
            <p>Catégorie: {{ selectedCategoryLabel }}</p>
            <p>Motif nom: {{ toUserFriendlyPattern(selectedRule.transactionNameRegex) || "-" }}</p>
            <p>Motif description: {{ toUserFriendlyPattern(selectedRule.transactionDescriptionRegex) || "-" }}</p>
        </div>

        <div v-if="showDeletePopover" class="delete-popover-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="delete-popover-card w-full max-w-md rounded-xl p-6">
                <h3 class="text-lg font-semibold">Supprimer la règle sélectionnée ?</h3>
                <p class="delete-popover-text mt-2 text-sm">
                    Cette action est définitive.
                </p>

                <div class="mt-6 flex justify-end gap-3">
                    <AppButton size="sm" variant="surface" @click="closeDeleteConfirmation">Annuler</AppButton>
                    <AppButton size="sm" variant="danger" @click="confirmDeleteRule">Confirmer</AppButton>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.transactions {
    padding: 20px;
    max-width: 1400px;
    margin: 0 auto;
}

.transactions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    gap: 15px;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.transactions-header h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 600;
    color: var(--color-text);
}

.actions-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    padding: 18px;
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--hover-primary-color) 100%);
    border-radius: 12px;
    box-shadow: var(--shadow-sm);
    position: sticky;
    top: 0;
    z-index: 20;
}

.group-controls {
    display: flex;
    gap: 8px;
}

.total-amount {
    font-weight: 700;
    font-size: 16px;
    color: white;
}

.form-section {
    margin-bottom: 30px;
    border: none;
    border-radius: 12px;
    padding: 25px;
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
}

.form-section h2 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 20px;
    color: var(--color-text);
    font-weight: 600;
}

.transaction-form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 18px;
}

.form-group {
    display: flex;
    flex-direction: column;
}

.form-group label {
    margin-bottom: 6px;
    font-weight: 600;
    font-size: 14px;
    color: var(--color-text);
}

.form-input {
    padding: 12px;
    border: 2px solid var(--input-border);
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
}

.form-actions {
    grid-column: 1 / -1;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 10px;
}

.form-hint {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--muted-text);
    font-size: 13px;
}

.transactions-list {
    margin-top: 30px;
}

.empty-state {
    text-align: center;
    padding: 60px;
    background: var(--color-surface);
    border-radius: 12px;
    color: var(--muted-text);
    box-shadow: var(--shadow-sm);
}

.transactions-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.transaction-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid var(--color-border);
    transition: all 0.2s;
    gap: 16px;
    min-height: 50px;
    background: var(--color-surface);
    border-radius: 10px;
    cursor: pointer;
}

.transaction-row:hover {
    background: var(--hover-bg);
}

.transaction-row.selected-row {
    background: var(--link-bg-light);
    border-left: 3px solid var(--primary-color);
}

.transaction-info {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    min-width: 0;
}

.transaction-main {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
}

.node-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 999px;
    white-space: nowrap;
    background: var(--hover-bg);
    color: var(--muted-text);
}

.transaction-name-compact {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 120px;
    max-width: 220px;
}

.transaction-description-compact {
    font-size: 13px;
    color: var(--muted-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
}

.transaction-secondary {
    display: flex;
    align-items: center;
    gap: 12px;
}

.transaction-status-compact {
    font-size: 11px;
    color: var(--muted-text);
    padding: 3px 8px;
    background: var(--hover-bg);
    border-radius: 12px;
    white-space: nowrap;
}

.selected-rule-panel {
    margin-top: 18px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 14px;
    color: var(--color-text);
}

.selected-rule-panel p {
    margin: 6px 0 0;
}

.delete-popover-overlay {
    background: color-mix(in srgb, var(--color-text) 24%, transparent);
}

.delete-popover-card {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-md);
}

.delete-popover-text {
    color: var(--muted-text);
}

@media (max-width: 768px) {
    .actions-bar {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }

    .group-controls {
        flex-wrap: wrap;
    }

    .transaction-row {
        flex-direction: column;
        align-items: flex-start;
    }

    .transaction-main {
        width: 100%;
        flex-wrap: wrap;
    }
}
</style>
