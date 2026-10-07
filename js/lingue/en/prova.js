// The mock exam (js/prova.js): the outcomes the student picks, and the summary.
export default {
  'prova.giusto': 'Right',
  'prova.meta': 'Half done',
  'prova.sbagliato': 'Wrong',
  'prova.non-fatto': 'Not done',
  'prova.hai-fatto': { one: 'You did {n} exercise out of {tot}.', other: 'You did {n} exercises out of {tot}.' },
  'prova.sei-stato': { one: 'You spent {n} minute out of {tot} on exercise {es}.', other: 'You spent {n} minutes out of {tot} on exercise {es}.' },
  'prova.valgono': { one: "The exercises you marked right are worth {presi} point out of {tot}. That's your call: Lode doesn't mark them.", other: "The exercises you marked right are worth {presi} points out of {tot}. That's your call: Lode doesn't mark them." },
  'prova.esiti-nella-mappa': 'The outcomes are on the syllabus map.',
  'prova.tornano-nei-temi': 'The exercises go back into your past papers: the right ones in 7 days, the wrong or half-done ones in 3.',
};
