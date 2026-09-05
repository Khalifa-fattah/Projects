const questions = [
    {
        question: "ما هو الشيء الذي لا يمشي إلا بالضرب؟",
        options: ["الساعة", "المسمار", "الطاولة", "الحذاء"],
        answer: "المسمار",
    },
    {
        question: "ما هو البيت الذي ليس فيه أبواب ولا نوافذ؟",
        options: ["بيت النمل", "بيت الشعر", "بيت الطيور", "بيت العنكبوت"],
        answer: "بيت الشعر",
    },
    {
        question: "ما هو الشيء الذي ينبض بلا قلب؟",
        options: ["الماء", "الساعة", "النهر", "الصوت"],
        answer: "الساعة",
    },
];

let currentQuestionIndex = 0;

const questionElement = document.getElementById("question");
const optionsContainer = document.getElementById("options");
const nextButton = document.getElementById("next-btn");

function showQuestion(question) {
    questionElement.textContent = question.question;
    optionsContainer.innerHTML = "";

    question.options.forEach((option) => {
        const button = document.createElement("button");
        button.textContent = option;
        button.addEventListener("click", () => checkAnswer(button, question.answer));
        optionsContainer.appendChild(button);
    });
}

function checkAnswer(button, correctAnswer) {
    if (button.textContent === correctAnswer) {
        button.classList.add("correct");
        nextButton.classList.remove("hidden");
    } else {
        button.classList.add("wrong");
    }

    Array.from(optionsContainer.children).forEach((btn) => {
        btn.disabled = true;
        if (btn.textContent === correctAnswer) {
            btn.classList.add("correct");
        }
    });
}

function showNextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        showQuestion(questions[currentQuestionIndex]);
        nextButton.classList.add("hidden");
    } else {
        questionElement.textContent = "مبروك! أكملت جميع الألغاز!";
        optionsContainer.innerHTML = "";
        nextButton.classList.add("hidden");
    }
}

nextButton.addEventListener("click", showNextQuestion);

// بدء اللعبة
showQuestion(questions[currentQuestionIndex]);