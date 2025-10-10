// src/utils/cart.js
export function saveCart(cartItems) {
  localStorage.setItem("tsogoCart", JSON.stringify(cartItems));
}

export function loadCart() {
  return JSON.parse(localStorage.getItem("tsogoCart") || "[]");
}

export function clearCart() {
  localStorage.removeItem("tsogoCart");
}

export function addToCart(product) {
  if (!product || !product.id) {
    console.error("Invalid product:", product);
    return;
  }

  const cart = loadCart();
  const existingIndex = cart.findIndex(item => item.id === product.id);

  if (existingIndex !== -1) {
    cart[existingIndex] = {
      ...cart[existingIndex],
      quantity: cart[existingIndex].quantity + 1
    };
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  saveCart(cart);
}

export function updateQuantity(productId, delta) {
  const cart = loadCart();
  const index = cart.findIndex(item => item.id === productId);
  if (index !== -1) {
    const newQty = cart[index].quantity + delta;
    if (newQty <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index] = { ...cart[index], quantity: newQty };
    }
    saveCart(cart);
  }
}

export function getCartTotal() {
  const cart = loadCart();
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
