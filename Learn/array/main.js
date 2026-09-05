let number = window.prompt();
if (number <= 20 && number > 0) {
    document.write("bad")
}
else if (number <= 50  && number > 20) {
    document.write("good")
}
else if (number <= 80 && number > 50 ) {
    document.write("very Good")
}
else if (number > 90 && number <= 100) {
    document.write("very nice")
}
else {
    document.write("not true value");
}
