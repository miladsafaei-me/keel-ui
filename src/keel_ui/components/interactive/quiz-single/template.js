var root = document.getElementById('{{ instance_id }}-root');
if (root) {
    var opts = root.querySelectorAll('.cp-quiz__option');
    var resultText = root.querySelector('.cp-quiz__result-text');
    opts.forEach(function (b) {
        b.addEventListener('click', function () {
            if (root.getAttribute('data-answered') === 'true') return;
            root.setAttribute('data-answered', 'true');
            var chosenCorrect = b.getAttribute('data-correct') === '1';
            root.setAttribute('data-outcome', chosenCorrect ? 'correct' : 'incorrect');
            opts.forEach(function (x) {
                var isCorrect = x.getAttribute('data-correct') === '1';
                if (isCorrect) {
                    x.setAttribute('data-state', 'correct');
                } else if (x === b) {
                    x.setAttribute('data-state', 'incorrect');
                } else {
                    x.setAttribute('data-state', 'unchosen');
                }
                x.setAttribute('aria-disabled', 'true');
            });
            if (resultText) {
                resultText.textContent = chosenCorrect
                    ? 'Correct — nice read.'
                    : 'Not quite. The right answer is highlighted in green.';
            }
        });
    });
}
