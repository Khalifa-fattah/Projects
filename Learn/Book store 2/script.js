let cartItems = [];
let totalPrice = 0;

function addToCart(bookName) {
  cartItems.push(bookName);
  
  // Update cart items list
  let cartList = document.getElementById("cart-items");
  let listItem = document.createElement("li");
  listItem.appendChild(document.createTextNode(bookName));
  cartList.appendChild(listItem);
  
  // Update total price
  totalPrice += getPrice(bookName);
  document.getElementById("total-price").textContent = totalPrice.toFixed(2);
}

function getPrice(bookName) {
    // You can implement your own logic to get the price based on the book name
    if (bookName === "Book 1") {
        return 10.00;
    } else if (bookName === "Book 2") {
        return 15.00;
    }
    
    // Add more conditions for other books
    
    return 0.00; // Default price if book not found
}

function checkout() {
    alert("Thank you for your purchase!");
    
    // Reset cart items and total price
    cartItems = [];
    totalPrice = 0.00;
    
    // Clear cart items list and total price display
    let cartList = document.getElementById("cart-items");
    while (cartList.firstChild) {
        cartList.removeChild(cartList.firstChild);
    }
    
    document.getElementById("total-price").textContent = totalPrice.toFixed(2);
}