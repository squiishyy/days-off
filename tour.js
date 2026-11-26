const TOUR_KEY = 'days-off.walkthrough.v1';
const steps = [
  {
    title: 'See the whole year. Zoom into a month.',
    text: 'Use Year for the big picture. Click a month name—or switch to Month—to plan the details.',
    visual: `<div class="tour-view-picker"><span class="chosen">Year</span><span>Month</span></div><div class="tour-months"><div><strong>January</strong><div class="tour-dots"><i></i><i></i><i></i><i class="pto"></i><i class="pto"></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="tour-selected-month"><strong>February ↗</strong><div class="tour-dots"><i></i><i></i><i></i><i></i><i class="holiday"></i><i></i><i></i><i></i><i class="pto"></i><i class="pto"></i><i></i><i></i><i></i><i></i></div></div><div><strong>March</strong><div class="tour-dots"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div></div>`
  },
  {
    title: 'Drag a few dates. Make a plan.',
    text: 'Click and drag across dates, then release to set hours and save. Weekends and holidays are excluded.',
    note: 'On a phone, tap a day and adjust the From and Through dates.',
    visual: `<div class="tour-week-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div><div class="tour-week"><div><span>8</span></div><div class="range"><span>9</span><small>8h PTO</small></div><div class="range"><span>10</span><small>8h PTO</small></div><div class="range"><span>11</span><small>8h PTO</small></div><div><span>12</span></div></div><div class="tour-drag-line"><span>←</span><span>Click, drag, release</span><span>→</span></div><div class="tour-example-total">3 workdays <span>·</span> 24 hours PTO</div>`
  },
  {
    title: 'Know what fits before you book.',
    text: 'Green PTO days are covered. Red days exceed your projected balance. Select a day to see the hours short.',
    note: 'Earlier time off affects later plans. Accrual is added every two weeks.',
    visual: `<div class="tour-balance-pair"><div class="tour-sample-day pto"><span>14</span><strong>8h PTO</strong><small>Covered</small></div><div class="tour-sample-day short"><span>15</span><strong>8h PTO</strong><small>3h short</small></div></div>`
  },
  {
    title: 'Company holiday? Mark it.',
    text: 'Right-click a date and choose Mark company holiday. It turns purple and uses no PTO.',
    note: 'You can also click a day and use its holiday button. Use Unmark to undo it.',
    visual: `<div class="tour-holiday-example"><div class="tour-sample-day holiday"><span>5</span><strong>Holiday</strong></div><div class="tour-example-menu"><span>Day actions</span><div>Plan PTO</div><div class="tour-menu-choice">Mark company holiday</div></div></div>`
  },
  {
    title: 'Change your mind. Change your days.',
    text: 'Click a PTO day to change its hours or choose Remove PTO. Drag across several dates to edit or remove them together.',
    visual: `<div class="tour-edit-example"><div class="tour-sample-day pto"><span>18</span><strong>8h PTO</strong></div><span class="tour-edit-arrow">→</span><div class="tour-example-editor"><span>PTO per workday</span><strong>4 <small>hours</small></strong><div><span class="tour-remove">Remove PTO</span><span class="tour-save">Save PTO</span></div></div></div>`
  },
  {
    title: 'Close it. Come back to your plan.',
    text: 'Your plan saves automatically in this browser and profile, including after a restart. Export a backup to move it elsewhere.',
    note: 'Settings updates your balance. Start over asks before clearing PTO and holidays. Replay this guide with How to use.',
    visual: `<div class="tour-save-example"><div class="tour-saved-check">✓</div><strong>Your plan, remembered.</strong><span>Same browser · Same profile</span><div><span>Export</span><span>Import</span></div></div>`
  }
];

export function createWalkthrough() {
  const dialog = document.getElementById('walkthrough');
  let index = 0, seen = false;
  try { seen = localStorage.getItem(TOUR_KEY) === 'seen'; } catch {}
  function render() {
    const step = steps[index];
    document.getElementById('tour-step').textContent = `Step ${index+1} of ${steps.length}`;
    document.getElementById('tour-title').textContent = step.title;
    document.getElementById('tour-text').textContent = step.text;
    document.getElementById('tour-note').textContent = step.note || '';
    document.getElementById('tour-visual').innerHTML = step.visual;
    document.getElementById('tour-back').disabled = index === 0;
    document.getElementById('tour-next').textContent = index === steps.length-1 ? 'Got it' : 'Next';
    document.getElementById('tour-dots').replaceChildren(...steps.map((_,i) => {
      const dot = document.createElement('span');
      dot.className = i === index ? 'current' : '';
      return dot;
    }));
  }
  function remember() { seen = true; try { localStorage.setItem(TOUR_KEY,'seen'); } catch {} }
  function close() { dialog.close(); }
  document.getElementById('tour-skip').onclick = close;
  document.getElementById('tour-back').onclick = () => { if(index>0){ index--; render(); } };
  document.getElementById('tour-next').onclick = () => { if(index===steps.length-1)close(); else {index++;render();} };
  dialog.addEventListener('close', () => { remember(); document.getElementById('help').focus({preventScroll:true}); });
  return {
    show({force=false}={}) {
      if ((seen && !force) || dialog.open) return;
      index=0; render(); dialog.showModal(); document.getElementById('tour-next').focus();
    }
  };
}
