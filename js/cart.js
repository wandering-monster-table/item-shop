const CART_STORAGE_KEY = "dnd-equipment-shop-cart";


// =========================================================
// Cart State
// =========================================================

const cart = new Map();


// =========================================================
// Cart Operations
// =========================================================

export function addToCart(itemId) {
    const quantity = cart.get(itemId) || 0;

    cart.set(itemId, quantity + 1);

    saveCart();
}

export function decreaseCartQuantity(itemId) {
    const quantity = cart.get(itemId);

    if (!quantity) {
        return;
    }

    if (quantity <= 1) {
        cart.delete(itemId);
    } else {
        cart.set(itemId, quantity - 1);
    }

    saveCart();
}

export function setCartQuantity(itemId, quantity) {
    const value = Number(quantity);

    if (!Number.isInteger(value) || value <= 0) {
        cart.delete(itemId);
    } else {
        cart.set(itemId, value);
    }

    saveCart();
}

export function removeFromCart(itemId) {
    cart.delete(itemId);

    saveCart();
}

export function clearCart() {
    cart.clear();

    saveCart();
}


// =========================================================
// Cart Access
// =========================================================

export function getCart() {
    return cart;
}

export function getCartQuantity(itemId) {
    return cart.get(itemId) || 0;
}

export function getCartItemCount() {
    let count = 0;

    for (const quantity of cart.values()) {
        count += quantity;
    }

    return count;
}

export function getCartTotal(items) {
    let total = 0;

    for (const [itemId, quantity] of cart) {
        const item = items.find(
            item => item.item_id === itemId
        );

        if (
            item &&
            typeof item.cost_cp === "number"
        ) {
            total += item.cost_cp * quantity;
        }
    }

    return total;
}

export function getCartWeight(items) {
    let total = 0;

    for (const [itemId, quantity] of cart) {
        const item = items.find(
            item => item.item_id === itemId
        );

        if (
            item &&
            typeof item.weight === "number"
        ) {
            total += item.weight * quantity;
        }
    }

    return total;
}

// =========================================================
// Persistence
// =========================================================

export function loadCart() {
    try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);

        if (!saved) {
            return;
        }

        const data = JSON.parse(saved);

        if (!data || typeof data !== "object") {
            return;
        }

        cart.clear();

        for (const [itemId, quantity] of Object.entries(data)) {
            if (
                typeof itemId === "string" &&
                Number.isInteger(quantity) &&
                quantity > 0
            ) {
                cart.set(itemId, quantity);
            }
        }
    } catch {
        // Ignore invalid or unavailable storage.
    }
}

function saveCart() {
    try {
        const data = Object.fromEntries(cart);

        localStorage.setItem(
            CART_STORAGE_KEY,
            JSON.stringify(data)
        );
    } catch {
        // Ignore storage errors.
    }
}