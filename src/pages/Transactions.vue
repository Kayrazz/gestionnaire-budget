<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import getCookie from "../utils/getCookies";
import type { Category, CurrencyCode, Transaction } from "../utils/JsonManager";
import { categoriesManager, transactionsManager, usersManager } from "../utils/JsonManager";
import { parseOfxTransactions } from "../utils/parseOfxTransactions";
import AppButton from "../components/AppButton.vue";
import AppToast from "../components/AppToast.vue";

/**
 * État du formulaire d'édition/création
 */
interface FormState {
    id: number | null;
    date: string;
    amount: number | string;
    nom: string;
    description: string;
    categories: number[];
    status: string;
    link: number[];
}

const isCurrencyCode = (value: string): value is CurrencyCode => {
    return value === "EUR" || value === "USD" || value === "GBP" || value === "JPY" || value === "CHF";
};

interface GroupedTransactionNode {
    transaction: Transaction;
    depth: number;
}

interface TransactionGroup {
    id: string;
    root: Transaction;
    nodes: GroupedTransactionNode[];
    childCount: number;
    totalAmount: number;
}

type ToastType = "success" | "info" | "alert";

/**
 * État initial du formulaire
 */
const defaultCurrency = ref<CurrencyCode>("EUR");
const currentUserId = ref<number | null>(null);
const ofxFileInput = ref<HTMLInputElement | null>(null);
const isImportingOfx = ref(false);
const toastVisible = ref(false);
const toastMessage = ref("");
const toastType = ref<ToastType>("info");

const showToast = (message: string, type: ToastType = "info"): void => {
    toastVisible.value = false;
    toastMessage.value = message;
    toastType.value = type;

    requestAnimationFrame(() => {
        toastVisible.value = true;
    });
};

const createInitialFormState = (): FormState => ({
    id: null,
    date: new Date().toISOString().split("T")[0] || "",
    amount: "",
    nom: "",
    description: "",
    categories: [],
    status: "",
    link: [],
});

/**
 * Liste des transactions
 */
const transactions = ref<Transaction[]>([]);

/**
 * Liste des catégories disponibles
 */
const categories = ref<Category[]>([]);

/**
 * État du formulaire d'ajout/modification
 */
const formState = ref<FormState>(createInitialFormState());

/**
 * Indicateur si on est en mode édition
 */
const isEditing = ref(false);

/**
 * ID de la transaction sélectionnée (sélection unitaire)
 */
const selectedTransactionId = ref<number | null>(null);

/**
 * État de la popover de confirmation de suppression
 */
const showDeletePopover = ref(false);
const pendingDeleteTransactionId = ref<number | null>(null);

/**
 * État du mode création de lien en 2 étapes: enfant puis parent
 */
const isLinkingMode = ref(false);
const linkChildId = ref<number | null>(null);

/**
 * IDs des groupes de transactions liées qui sont expansés
 */
const expandedGroups = ref<Set<string>>(new Set());

/**
 * Filtres de la liste
 */
const selectedFilterDate = ref<string>("");
const selectedFilterCategory = ref<string>("all");

/**
 * Active/annule le mode lien (sélection enfant puis parent)
 */
const toggleLinkingMode = (): void => {
    if (isLinkingMode.value) {
        isLinkingMode.value = false;
        linkChildId.value = null;
        return;
    }

    isLinkingMode.value = true;
    linkChildId.value = null;
};

/**
 * Toggle l'état d'expansion d'un groupe
 */
const toggleGroup = (groupId: string): void => {
    if (expandedGroups.value.has(groupId)) {
        expandedGroups.value.delete(groupId);
    } else {
        expandedGroups.value.add(groupId);
    }
};

/**
 * Vérifie si un groupe est expansé
 */
const isGroupExpanded = (groupId: string): boolean => {
    return expandedGroups.value.has(groupId);
};

/**
 * Initialise le composant en chargeant les transactions
 */
onMounted(async () => {
    const userIdCookie = getCookie("user_id");
    const parsedUserId = userIdCookie ? Number.parseInt(userIdCookie, 10) : Number.NaN;

    if (Number.isInteger(parsedUserId) && parsedUserId > 0) {
        currentUserId.value = parsedUserId;
        await usersManager.init(parsedUserId);
        const currentUser = usersManager.getById(parsedUserId);
        if (currentUser?.currency && isCurrencyCode(currentUser.currency)) {
            defaultCurrency.value = currentUser.currency;
        }
    }

    await transactionsManager.init(currentUserId.value ?? undefined);
    await categoriesManager.init(currentUserId.value ?? undefined);
    transactions.value = transactionsManager.getAll();
    categories.value = categoriesManager.getAll();
});

/**
 * ID catégorie sélectionnée dans le filtre (null = toutes)
 */
const selectedFilterCategoryId = computed<number | null>(() => {
    if (selectedFilterCategory.value === "all") {
        return null;
    }

    const parsedCategoryId = Number(selectedFilterCategory.value);
    return Number.isInteger(parsedCategoryId) ? parsedCategoryId : null;
});

/**
 * Transactions filtrées par date et catégorie
 */
const filteredTransactions = computed<Transaction[]>(() => {
    return transactions.value.filter((transaction: Transaction) => {
        const transactionMonth = transaction.date.slice(0, 7);
        const matchesDate =
            !selectedFilterDate.value ||
            transactionMonth === selectedFilterDate.value;

        const categoryId = selectedFilterCategoryId.value;
        const matchesCategory = categoryId === null || transaction.categories.includes(categoryId);

        return matchesDate && matchesCategory;
    });
});

/**
 * Retourne le parent direct d'une transaction (si présent)
 */
const getParentTransaction = (childId: number): Transaction | null => {
    return (
        transactions.value.find((transaction: Transaction) => transaction.link.includes(childId)) ?? null
    );
};

/**
 * Vérifie si un lien créerait une boucle dans la hiérarchie
 */
const wouldCreateCycle = (childId: number, candidateParentId: number): boolean => {
    const visited = new Set<number>();

    const walk = (currentId: number): boolean => {
        if (currentId === childId) {
            return true;
        }
        if (visited.has(currentId)) {
            return false;
        }

        visited.add(currentId);
        const current = transactionsManager.getById(currentId);
        if (!current) {
            return false;
        }

        return current.link.some((nextId: number) => walk(nextId));
    };

    return walk(candidateParentId);
};

/**
 * Groupe les transactions en arbre parent -> enfants (chaînage)
 */
const groupedTransactions = computed<TransactionGroup[]>(() => {
    const byId = new Map<number, Transaction>(
        filteredTransactions.value.map((transaction: Transaction) => [transaction.id, transaction]),
    );

    const parentByChild = new Map<number, number>();
    filteredTransactions.value.forEach((parent: Transaction) => {
        parent.link.forEach((childId: number) => {
            if (byId.has(childId)) {
                parentByChild.set(childId, parent.id);
            }
        });
    });

    const roots = filteredTransactions.value.filter((transaction: Transaction) => !parentByChild.has(transaction.id));
    const groups: TransactionGroup[] = [];
    const globallyVisited = new Set<number>();

    const buildGroupFromRoot = (root: Transaction): TransactionGroup => {
        const nodes: GroupedTransactionNode[] = [];
        const localVisited = new Set<number>();

        const walk = (transaction: Transaction, depth: number): void => {
            if (localVisited.has(transaction.id)) {
                return;
            }

            localVisited.add(transaction.id);
            globallyVisited.add(transaction.id);
            nodes.push({ transaction, depth });

            transaction.link.forEach((childId: number) => {
                const child = byId.get(childId);
                if (child) {
                    walk(child, depth + 1);
                }
            });
        };

        walk(root, 0);

        const totalAmount = nodes.reduce((sum: number, node: GroupedTransactionNode) => {
            return sum + node.transaction.amount;
        }, 0);

        return {
            id: `group-${root.id}`,
            root,
            nodes,
            childCount: Math.max(0, nodes.length - 1),
            totalAmount,
        };
    };

    roots.forEach((root: Transaction) => {
        groups.push(buildGroupFromRoot(root));
    });

    filteredTransactions.value
        .filter((transaction: Transaction) => !globallyVisited.has(transaction.id))
        .forEach((transaction: Transaction) => {
            groups.push(buildGroupFromRoot(transaction));
        });

    return groups;
});

/**
 * IDs des groupes qui peuvent être pliés/dépliés (groupes avec enfants)
 */
const collapsibleGroupIds = computed<string[]>(() => {
    return groupedTransactions.value
        .filter((group: TransactionGroup) => group.childCount > 0)
        .map((group: TransactionGroup) => group.id);
});

/**
 * État global de pliage/dépliage
 */
const areAllGroupsExpanded = computed<boolean>(() => {
    if (collapsibleGroupIds.value.length === 0) {
        return false;
    }
    return collapsibleGroupIds.value.every((groupId: string) => expandedGroups.value.has(groupId));
});

const areAllGroupsCollapsed = computed<boolean>(() => {
    if (collapsibleGroupIds.value.length === 0) {
        return true;
    }
    return collapsibleGroupIds.value.every((groupId: string) => !expandedGroups.value.has(groupId));
});

/**
 * Actions globales de pliage/dépliage
 */
const collapseAllGroups = (): void => {
    expandedGroups.value.clear();
};

const expandAllGroups = (): void => {
    collapsibleGroupIds.value.forEach((groupId: string) => expandedGroups.value.add(groupId));
};

/**
 * Calcule le montant total des transactions
 */
const totalAmount = computed(() => {
    return filteredTransactions.value.reduce((sum: number, t: Transaction) => sum + t.amount, 0).toFixed(2);
});

/**
 * Retourne la catégorie principale affichée pour une transaction (1 seule assignation)
 */
const getAssignedCategoryId = (transaction: Transaction): string => {
    return transaction.categories[0] ? String(transaction.categories[0]) : "";
};

/**
 * Met à jour la catégorie d'une transaction depuis le sélecteur de ligne
 */
const onTransactionCategoryChange = (transactionId: number, event: Event): void => {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
        return;
    }

    const nextCategoryId = Number(target.value);
    const nextCategories = Number.isInteger(nextCategoryId) && nextCategoryId > 0 ? [nextCategoryId] : [];

    const updated = transactionsManager.update(transactionId, { categories: nextCategories });
    if (updated) {
        transactions.value = transactionsManager.getAll();
    }
};

/**
 * Réinitialise le formulaire à son état initial
 */
const resetForm = (): void => {
    formState.value = createInitialFormState();
    isEditing.value = false;
};

/**
 * Ouvre le formulaire pour créer une nouvelle transaction
 */
const openCreateForm = (): void => {
    resetForm();
    isEditing.value = true;
};

/**
 * Ouvre le formulaire pour éditer une transaction existante
 */
const openEditForm = (transaction: Transaction): void => {
    formState.value = {
        id: transaction.id,
        date: transaction.date.split("T")[0] || "",
        amount: transaction.amount,
        nom: transaction.nom,
        description: transaction.description,
        categories: [...transaction.categories],
        status: transaction.status,
        link: [...transaction.link],
    };
    isEditing.value = true;
};

/**
 * Sélectionne/désélectionne une transaction
 */
const toggleTransactionSelection = (transactionId: number): void => {
    selectedTransactionId.value =
        selectedTransactionId.value === transactionId ? null : transactionId;
};

/**
 * Gère le clic sur une ligne: sélection standard ou création de lien enfant -> parent
 */
const handleTransactionRowClick = (transactionId: number): void => {
    if (!isLinkingMode.value) {
        toggleTransactionSelection(transactionId);
        return;
    }

    if (linkChildId.value === null) {
        linkChildId.value = transactionId;
        selectedTransactionId.value = transactionId;
        return;
    }

    const childId = linkChildId.value;
    const parentId = transactionId;

    if (childId === parentId) {
        showToast("Une transaction ne peut pas être son propre parent.", "alert");
        return;
    }

    if (wouldCreateCycle(childId, parentId)) {
        showToast("Ce lien créerait une boucle dans la hiérarchie.", "alert");
        return;
    }

    const parentTransaction = transactionsManager.getById(parentId);
    if (!parentTransaction) {
        return;
    }

    const currentParent = getParentTransaction(childId);
    if (currentParent) {
        const parentNextLinks = currentParent.link.filter((id: number) => id !== childId);
        transactionsManager.update(currentParent.id, { link: parentNextLinks });
    }

    if (!parentTransaction.link.includes(childId)) {
        transactionsManager.update(parentId, { link: [...parentTransaction.link, childId] });
    }

    transactions.value = transactionsManager.getAll();
    selectedTransactionId.value = parentId;
    linkChildId.value = null;
};

/**
 * Retourne la transaction actuellement sélectionnée
 */
const selectedTransaction = computed<Transaction | null>(() => {
    if (selectedTransactionId.value === null) {
        return null;
    }
    return transactions.value.find((transaction: Transaction) => transaction.id === selectedTransactionId.value) ?? null;
});

/**
 * Transaction ciblée par la popover de suppression
 */
const pendingDeleteTransaction = computed<Transaction | null>(() => {
    if (pendingDeleteTransactionId.value === null) {
        return null;
    }
    return (
        transactions.value.find((transaction: Transaction) => transaction.id === pendingDeleteTransactionId.value) ??
        null
    );
});

/**
 * Ouvre le formulaire d'édition pour la transaction sélectionnée
 */
const editSelectedTransaction = (): void => {
    if (!selectedTransaction.value) {
        return;
    }

    if (isEditing.value && formState.value.id === selectedTransaction.value.id) {
        cancelEdit();
        return;
    }

    openEditForm(selectedTransaction.value);
};

/**
 * Supprime la transaction sélectionnée
 */
const deleteSelectedTransaction = (): void => {
    if (!selectedTransaction.value) {
        return;
    }

    pendingDeleteTransactionId.value = selectedTransaction.value.id;
    showDeletePopover.value = true;
};

/**
 * Ferme la popover de suppression
 */
const closeDeletePopover = (): void => {
    showDeletePopover.value = false;
    pendingDeleteTransactionId.value = null;
};

/**
 * Confirme et exécute la suppression de la transaction ciblée
 */
const confirmDeleteTransaction = (): void => {
    if (pendingDeleteTransactionId.value === null) {
        return;
    }

    deleteTransaction(pendingDeleteTransactionId.value);
    closeDeletePopover();
};

/**
 * Sauvegarde ou crée une transaction
 */
const saveTransaction = (): void => {
    const userId = currentUserId.value;

    if (!userId) {
        showToast("Utilisateur non connecté. Veuillez vous reconnecter.", "alert");
        return;
    }

    const amount = Number(formState.value.amount);

    if (!formState.value.nom.trim()) {
        showToast("Le nom de la transaction est requis", "alert");
        return;
    }

    if (isNaN(amount)) {
        showToast("Le montant doit être un nombre valide", "alert");
        return;
    }

    if (!formState.value.date) {
        showToast("La date est requise", "alert");
        return;
    }

    const transactionData = {
        date: new Date(formState.value.date).toISOString(),
        amount,
        nom: formState.value.nom.trim(),
        description: formState.value.description.trim(),
        categories: formState.value.categories,
        status: formState.value.status,
        link: formState.value.link,
        user_id: userId,
    };

    if (formState.value.id !== null) {
        const updated = transactionsManager.update(formState.value.id, transactionData);
        if (updated) {
            transactions.value = transactionsManager.getAll();
        }
    } else {
        transactionsManager.create(transactionData as Omit<Transaction, "id">);
        transactions.value = transactionsManager.getAll();
    }

    resetForm();
};

const buildTransactionDedupKey = (transaction: {
    date: string;
    amount: number;
    nom: string;
    description: string;
}): string => {
    return [
        transaction.date.slice(0, 10),
        transaction.amount.toFixed(2),
        transaction.nom.trim().toLowerCase(),
        transaction.description.trim().toLowerCase(),
    ].join("|");
};

const openOfxFilePicker = (): void => {
    ofxFileInput.value?.click();
};

const importOfxFile = async (file: File): Promise<void> => {
    const userId = currentUserId.value;
    if (!userId) {
        showToast("Utilisateur non connecté. Veuillez vous reconnecter.", "alert");
        return;
    }

    isImportingOfx.value = true;

    try {
        const ofxContent = await file.text();
        const parsedTransactions = parseOfxTransactions(ofxContent);

        const existingKeys = new Set(
            transactions.value.map((transaction: Transaction) =>
                buildTransactionDedupKey({
                    date: transaction.date,
                    amount: transaction.amount,
                    nom: transaction.nom,
                    description: transaction.description,
                }),
            ),
        );

        let importedCount = 0;
        let skippedCount = 0;

        parsedTransactions.forEach((parsedTransaction) => {
            const descriptionParts = [parsedTransaction.description];
            if (parsedTransaction.fitId) {
                descriptionParts.push(`FITID: ${parsedTransaction.fitId}`);
            }

            const description = descriptionParts.filter(Boolean).join(" • ");
            const dedupKey = buildTransactionDedupKey({
                date: parsedTransaction.date,
                amount: parsedTransaction.amount,
                nom: parsedTransaction.nom,
                description,
            });

            if (existingKeys.has(dedupKey)) {
                skippedCount += 1;
                return;
            }

            transactionsManager.create({
                date: parsedTransaction.date,
                amount: parsedTransaction.amount,
                nom: parsedTransaction.nom,
                description,
                categories: [],
                status: parsedTransaction.status,
                link: [],
                user_id: userId,
            });

            existingKeys.add(dedupKey);
            importedCount += 1;
        });

        transactions.value = transactionsManager.getAll();

        if (importedCount === 0) {
            showToast("Aucune nouvelle transaction importée (doublons détectés).", "info");
            return;
        }

        showToast(
            skippedCount > 0
                ? `${importedCount} transaction(s) importée(s), ${skippedCount} doublon(s) ignoré(s).`
                : `${importedCount} transaction(s) importée(s) avec succès.`,
            "success",
        );
    } catch (error) {
        const fallbackMessage = "Erreur lors de l'import OFX.";
        const message = error instanceof Error ? error.message : fallbackMessage;
        showToast(message, "alert");
    } finally {
        isImportingOfx.value = false;
    }
};

const onOfxFileSelected = async (event: Event): Promise<void> => {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
        return;
    }

    await importOfxFile(file);

    if (input) {
        input.value = "";
    }
};

/**
 * Supprime une transaction
 */
const deleteTransaction = (id: number): void => {
    const deleted = transactionsManager.delete(id);
    if (deleted) {
        transactions.value = transactionsManager.getAll();
        if (selectedTransactionId.value === id) {
            selectedTransactionId.value = null;
        }

        if (isEditing.value && formState.value.id === id) {
            resetForm();
        }
    }
};

/**
 * Retire un lien parent -> enfant
 */
const removeParentChildLink = (parentId: number, childId: number): void => {
    const parentTransaction = transactionsManager.getById(parentId);
    if (!parentTransaction) {
        return;
    }

    const nextLinks = parentTransaction.link.filter((id: number) => id !== childId);
    transactionsManager.update(parentId, { link: nextLinks });
    transactions.value = transactionsManager.getAll();
};

/**
 * Supprime tous les liens parent -> enfant d'un groupe
 */
const removeAllGroupLinks = (group: TransactionGroup): void => {
    group.nodes.forEach((node: GroupedTransactionNode) => {
        if (node.transaction.link.length > 0) {
            transactionsManager.update(node.transaction.id, { link: [] });
        }
    });
    transactions.value = transactionsManager.getAll();
};

/**
 * Retire le parent direct d'une transaction
 */
const removeParentLink = (childId: number): void => {
    const parent = getParentTransaction(childId);
    if (!parent) {
        return;
    }
    removeParentChildLink(parent.id, childId);
};

/**
 * Annule l'édition et restaure l'état initial
 */
const cancelEdit = (): void => {
    resetForm();
};
</script>

<template>
    <div class="transactions">
        <AppToast
            v-model="toastVisible"
            :message="toastMessage"
            :type="toastType"
        />

        <input
            ref="ofxFileInput"
            type="file"
            accept=".ofx"
            class="hidden"
            @change="onOfxFileSelected"
        />

        <div class="transactions-header">
            <h1>Transactions</h1>
            <div class="header-actions">
                <AppButton
                    size="sm"
                    variant="surface"
                    @click="openOfxFilePicker"
                    :disabled="isImportingOfx"
                >
                    {{ isImportingOfx ? "Import OFX..." : "Import de données" }}
                </AppButton>
                <AppButton @click="openCreateForm">Nouveau</AppButton>
            </div>
        </div>

        <div class="actions-bar">
            <div class="group-controls">
                <AppButton
                    size="sm"
                    variant="surface"
                    @click="collapseAllGroups"
                    :disabled="areAllGroupsCollapsed"
                >
                    Tout plier
                </AppButton>
                <AppButton
                    size="sm"
                    variant="surface"
                    @click="expandAllGroups"
                    :disabled="areAllGroupsExpanded"
                >
                    Tout déplier
                </AppButton>
                <AppButton
                    size="sm"
                    :variant="isLinkingMode ? 'danger' : 'surface'"
                    @click="toggleLinkingMode"
                >
                    Lien
                </AppButton>
                <AppButton
                    size="sm"
                    variant="surface"
                    @click="editSelectedTransaction"
                    :disabled="!selectedTransaction"
                >
                    Modifier
                </AppButton>
                <AppButton
                    size="sm"
                    variant="danger"
                    @click="deleteSelectedTransaction"
                    :disabled="!selectedTransaction"
                >
                    Supprimer
                </AppButton>
            </div>
            <span class="total-amount">Total: {{ totalAmount }} {{ defaultCurrency }}</span>
        </div>

        <div class="filters-bar">
            <div class="filter-group">
                <label for="filter-date">Mois</label>
                <input id="filter-date" v-model="selectedFilterDate" type="month" class="filter-input" />
            </div>

            <div class="filter-group">
                <label for="filter-category">Catégorie</label>
                <select id="filter-category" v-model="selectedFilterCategory" class="filter-input">
                    <option value="all">Toutes les catégories</option>
                    <option v-for="category in categories" :key="category.id" :value="String(category.id)">
                        {{ category.name }}
                    </option>
                </select>
            </div>
        </div>

        <p v-if="isLinkingMode" class="link-mode-hint">
            {{ linkChildId === null
                ? "Mode lien: cliquez d'abord sur la transaction enfant."
                : "Mode lien: cliquez maintenant sur la transaction parent." }}
        </p>
        

        <!-- Formulaire d'ajout/modification -->
        <div v-if="isEditing" class="form-section">
            <h2>{{ formState.id !== null ? "Modifier" : "Ajouter" }} une transaction</h2>
            <form @submit.prevent="saveTransaction" class="transaction-form">
                <div class="form-group">
                    <label for="date">Date</label>
                    <input
                        id="date"
                        v-model="formState.date"
                        type="date"
                        required
                        class="form-input"
                    />
                </div>

                <div class="form-group">
                    <label for="nom">Nom</label>
                    <input
                        id="nom"
                        v-model="formState.nom"
                        type="text"
                        placeholder="ex: Carrefour"
                        required
                        class="form-input"
                    />
                </div>

                <div class="form-group">
                    <label for="amount">Montant</label>
                    <input
                        id="amount"
                        v-model="formState.amount"
                        type="number"
                        placeholder="ex: -50.00"
                        step="0.01"
                        required
                        class="form-input"
                    />
                </div>

                <div class="form-group">
                    <label for="description">Description</label>
                    <textarea
                        id="description"
                        v-model="formState.description"
                        placeholder="Détails supplémentaires"
                        class="form-input"
                        rows="3"
                    ></textarea>
                </div>

                <div class="form-group">
                    <label for="status">Statut</label>
                    <input
                        id="status"
                        v-model="formState.status"
                        type="text"
                        placeholder="ex: En attente, Confirmé"
                        class="form-input"
                    />
                </div>

                <div class="form-actions">
                    <AppButton type="submit">Enregistrer</AppButton>
                    <AppButton type="button" variant="danger" @click="cancelEdit">Annuler</AppButton>
                </div>
            </form>
        </div>

        <!-- Liste des transactions -->
        <div class="transactions-list">
            <div v-if="groupedTransactions.length === 0" class="empty-state">
                <p>Aucune transaction à afficher</p>
            </div>

            <div v-else class="transactions-grid">
                <div 
                    v-for="group in groupedTransactions" 
                    :key="group.id"
                    class="transaction-group"
                    :class="{ 'is-linked': group.childCount > 0 }"
                >
                    <!-- En-tête du groupe (pour les transactions liées) -->
                    <div 
                        v-if="group.childCount > 0" 
                        class="group-header"
                        @click="toggleGroup(group.id)"
                    >
                        <div class="group-header-content">
                            <svg 
                                class="expand-icon" 
                                :class="{ 'expanded': isGroupExpanded(group.id) }"
                                width="20" 
                                height="20" 
                                viewBox="0 0 24 24" 
                                fill="none"
                            >
                                <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <svg class="link-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span class="group-title">
                                {{ group.root.nom }} • {{ group.childCount }} enfant{{ group.childCount > 1 ? "s" : "" }}
                            </span>
                            <span class="group-total" :class="{ 
                                'positive': group.totalAmount > 0,
                                'negative': group.totalAmount < 0
                            }">
                                Total: {{ group.totalAmount.toFixed(2) }} {{ defaultCurrency }}
                            </span>
                        </div>
                        <AppButton
                            v-if="group.childCount > 0"
                            size="sm"
                            variant="danger"
                            @click.stop="removeAllGroupLinks(group)"
                            class="unlink-group-btn"
                        >
                            Tout délier
                        </AppButton>
                    </div>

                    <!-- Contenu du groupe -->
                    <div 
                        class="group-content"
                        :class="{ 
                            'collapsed': group.childCount > 0 && !isGroupExpanded(group.id)
                        }"
                    >
                        <div
                            v-for="node in group.nodes"
                            :key="node.transaction.id"
                            class="transaction-row"
                            :style="{ marginLeft: `${node.depth * 22}px` }"
                            @click="handleTransactionRowClick(node.transaction.id)"
                            :class="{
                                'link-source': isLinkingMode && linkChildId === node.transaction.id,
                                'link-active': isLinkingMode && linkChildId !== null && linkChildId !== node.transaction.id,
                                'child-row': node.depth > 0,
                                'selected-row': selectedTransactionId === node.transaction.id,
                            }"
                        >
                            <div class="transaction-info">
                                <div class="transaction-main">
                                    <span class="node-badge" :class="{ 'is-parent': node.depth === 0, 'is-child': node.depth > 0 }">
                                        {{ node.depth === 0 ? "Parent" : "Enfant" }}
                                    </span>
                                    <span class="transaction-date-compact">
                                        {{ new Date(node.transaction.date).toLocaleDateString("fr-FR") }}
                                    </span>
                                    <h4 class="transaction-name-compact">{{ node.transaction.nom }}</h4>
                                    <span v-if="node.transaction.description" class="transaction-description-compact">
                                        {{ node.transaction.description }}
                                    </span>
                                </div>
                                <div class="transaction-secondary">
                                    <span v-if="node.transaction.status" class="transaction-status-compact">
                                        {{ node.transaction.status }}
                                    </span>
                                    <select
                                        class="transaction-category-select"
                                        :value="getAssignedCategoryId(node.transaction)"
                                        @click.stop
                                        @change="onTransactionCategoryChange(node.transaction.id, $event)"
                                    >
                                        <option value="">Sans catégorie</option>
                                        <option
                                            v-for="category in categories"
                                            :key="`tx-${node.transaction.id}-cat-${category.id}`"
                                            :value="String(category.id)"
                                        >
                                            {{ category.name }}
                                        </option>
                                    </select>
                                    <div 
                                        class="transaction-amount-compact"
                                        :class="{ 
                                            'amount-positive': node.transaction.amount > 0, 
                                            'amount-negative': node.transaction.amount < 0 
                                        }"
                                    >
                                        {{ node.transaction.amount > 0 ? "+" : "" }}{{ node.transaction.amount.toFixed(2) }} {{ defaultCurrency }}
                                    </div>
                                </div>
                            </div>

                            <div class="transaction-actions-compact" @click.stop>
                                <button
                                    v-if="node.depth > 0"
                                    @click="removeParentLink(node.transaction.id)"
                                    class="link-to-btn-compact unlink-btn-compact"
                                    type="button"
                                >
                                    Retirer parent
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div
            v-if="showDeletePopover"
            class="delete-popover-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
            @click.self="closeDeletePopover"
        >
            <div class="delete-popover-card w-full max-w-md rounded p-4 space-y-4">
                <h2 class="text-lg font-semibold">Confirmer la suppression</h2>
                <p class="delete-popover-text text-sm">
                    Vous allez supprimer la transaction
                    <strong>{{ pendingDeleteTransaction?.nom || "inconnue" }}</strong>
                    ({{ pendingDeleteTransaction ? new Date(pendingDeleteTransaction.date).toLocaleDateString("fr-FR") : "date inconnue" }}).
                    Cette action est irréversible.
                </p>

                <div class="flex justify-end gap-2">
                    <AppButton type="button" @click="closeDeletePopover">Annuler</AppButton>
                    <AppButton
                        type="button"
                        variant="danger"
                        @click="confirmDeleteTransaction"
                    >
                        Confirmer
                    </AppButton>
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

.header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}
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

.link-mode-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-weight: 500;
    color: white;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    transition: background 0.3s;
}

.link-mode-toggle:hover {
    background: rgba(255, 255, 255, 0.3);
}

.link-mode-toggle input[type="checkbox"] {
    cursor: pointer;
    width: 18px;
    height: 18px;
    accent-color: white;
}

.total-amount {
    font-weight: 700;
    font-size: 20px;
    color: white;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.group-controls {
    display: flex;
    gap: 8px;
}

.filters-bar {
    display: flex;
    gap: 16px;
    align-items: end;
    margin-bottom: 18px;
    padding: 14px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: var(--shadow-sm);
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 220px;
}

.filter-group label {
    font-size: 13px;
    color: var(--muted-text);
    font-weight: 600;
}

.filter-input {
    padding: 9px 10px;
    border: 1px solid var(--input-border);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-text);
}

.link-mode-hint {
    margin-top: -10px;
    margin-bottom: 20px;
    color: var(--muted-text);
    font-size: 14px;
    font-weight: 500;
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
    transition: all 0.3s;
}

.form-input:focus {
    outline: none;
    border-color: var(--input-border-focus);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-actions {
    grid-column: 1 / -1;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 10px;
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
    gap: 16px;
}

.transaction-group {
    background: var(--color-surface);
    border-radius: 12px;
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition: all 0.3s;
}

.transaction-group:hover {
    box-shadow: var(--shadow-md);
}

.transaction-group.is-linked {
    border: 2px solid var(--primary-color);
}

.group-header {
    padding: 16px 20px;
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--hover-primary-color) 100%);
    color: white;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.3s;
}

.group-header:hover {
    opacity: 0.9;
}

.group-header-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
}

.expand-icon {
    transition: transform 0.3s;
    color: white;
}

.expand-icon.expanded {
    transform: rotate(90deg);
}

.link-icon {
    color: white;
}

.group-title {
    font-weight: 600;
    font-size: 15px;
}

.group-total {
    margin-left: auto;
    font-weight: 700;
    font-size: 16px;
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 20px;
}

.group-total.positive {
    background: var(--success-bg);
}

.group-total.negative {
    background: var(--danger-bg);
}

.unlink-group-btn {
    margin-left: 16px;
}

.group-content {
    max-height: 2000px;
    overflow: hidden;
    transition: max-height 0.4s ease-out, opacity 0.3s;
    opacity: 1;
}

.group-content.collapsed {
    max-height: 0;
    opacity: 0;
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
}

.transaction-row:last-child {
    border-bottom: none;
}

.transaction-row:hover {
    background: var(--hover-bg);
}

.transaction-row.selected-row {
    background: var(--link-bg-light);
    border-left: 3px solid var(--primary-color);
}

.transaction-row.link-source {
    background: var(--link-bg);
    border-left: 3px solid var(--link-color);
}

.transaction-row.link-active {
    background: var(--link-bg-light);
    cursor: pointer;
}

.transaction-row.child-row {
    border-left: 2px solid var(--color-border);
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

.node-badge.is-parent {
    background: var(--link-bg-light);
    color: var(--link-color);
}

.node-badge.is-child {
    background: var(--hover-bg);
    color: var(--muted-text);
}

.transaction-date-compact {
    font-size: 12px;
    color: var(--muted-text);
    font-weight: 500;
    white-space: nowrap;
    min-width: 75px;
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
    max-width: 200px;
}

.transaction-description-compact {
    font-size: 13px;
    color: var(--muted-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    max-width: 300px;
}

.transaction-secondary {
    display: flex;
    align-items: center;
    gap: 12px;
}

.transaction-category-select {
    max-width: 170px;
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
}

.transaction-status-compact {
    font-size: 11px;
    color: var(--muted-text);
    padding: 3px 8px;
    background: var(--hover-bg);
    border-radius: 12px;
    white-space: nowrap;
}

.transaction-amount-compact {
    font-size: 15px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 6px;
    background: var(--hover-bg);
    white-space: nowrap;
    min-width: 90px;
    text-align: right;
}

.transaction-amount-compact.amount-positive {
    color: var(--success-color);
    background: var(--success-bg);
}

.transaction-amount-compact.amount-negative {
    color: var(--danger-color);
    background: var(--danger-bg);
}

.transaction-actions-compact {
    display: flex;
    gap: 6px;
    flex-wrap: nowrap;
}

.link-to-btn-compact {
    padding: 6px 12px;
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--hover-primary-color) 100%);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.2s;
    white-space: nowrap;
}

.link-to-btn-compact:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-primary);
}

.link-to-btn-compact:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

.unlink-btn-compact {
    background: linear-gradient(135deg, var(--danger-color) 0%, var(--danger-color) 100%);
}

.unlink-btn-compact:hover {
    box-shadow: var(--shadow-danger);
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

@media (max-width: 1024px) {
    .transactions {
        padding: 16px;
    }

    .actions-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
    }

    .group-controls {
        flex-wrap: wrap;
    }

    .total-amount {
        text-align: right;
    }

    .filters-bar {
        flex-direction: column;
        align-items: stretch;
    }

    .filter-group {
        min-width: 0;
        width: 100%;
    }

    .transaction-description-compact {
        max-width: 100%;
    }
}

@media (max-width: 768px) {
    .transactions {
        padding: 12px;
    }

    .transactions-header {
        flex-direction: column;
        align-items: stretch;
    }

    .transactions-header :deep(button) {
        width: 100%;
    }

    .group-header {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
    }

    .group-header-content {
        flex-wrap: wrap;
        gap: 8px;
    }

    .group-total {
        margin-left: 0;
    }

    .unlink-group-btn {
        margin-left: 0;
        width: 100%;
    }

    .transaction-row {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        padding: 10px 12px;
    }

    .transaction-info {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
    }

    .transaction-main {
        flex-wrap: wrap;
        gap: 8px;
    }

    .transaction-name-compact,
    .transaction-description-compact {
        min-width: 0;
        max-width: 100%;
    }

    .transaction-secondary {
        flex-wrap: wrap;
        gap: 8px;
    }

    .transaction-category-select {
        max-width: none;
        width: 100%;
    }

    .transaction-amount-compact {
        min-width: 0;
        margin-left: auto;
    }

    .transaction-actions-compact {
        width: 100%;
        justify-content: flex-end;
    }

    .link-to-btn-compact {
        width: 100%;
    }
}

@media (max-width: 480px) {
    .transactions-header h1 {
        font-size: 24px;
    }

    .actions-bar {
        padding: 12px;
    }

    .form-section {
        padding: 16px;
    }

    .transaction-form {
        grid-template-columns: 1fr;
    }

    .transaction-date-compact {
        min-width: 0;
    }

    .transaction-amount-compact {
        width: 100%;
        text-align: left;
    }

    .delete-popover-card {
        max-width: 100%;
    }
}
</style>