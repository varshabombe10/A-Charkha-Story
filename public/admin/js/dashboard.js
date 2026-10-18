document.addEventListener('DOMContentLoaded', async () => {
  const admin = await checkAdminAuth();
  if (!admin) return;

  loadStats();
  loadSalesChart();
  loadCategoryChart();
  loadActivity();
});

async function loadStats() {
  try {
    const stats = await AdminAPI.getStats();
    animateCounter(document.getElementById('stat-revenue'), Math.round(stats.totalRevenue), '₹');
    animateCounter(document.getElementById('stat-orders'), stats.totalOrders);
    animateCounter(document.getElementById('stat-users'), stats.totalUsers);
    animateCounter(document.getElementById('stat-products'), stats.totalProducts);
    animateCounter(document.getElementById('stat-pending'), stats.pendingOrders);
    animateCounter(document.getElementById('stat-lowstock'), stats.lowStockCount);
  } catch (err) {
    console.error('Stats error:', err);
  }
}

async function loadSalesChart() {
  try {
    const data = await AdminAPI.getSalesChart();
    const ctx = document.getElementById('sales-chart').getContext('2d');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => {
          const date = new Date(d.date);
          return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        }),
        datasets: [{
          label: 'Revenue',
          data: data.map(d => d.revenue),
          borderColor: '#C2703E',
          backgroundColor: 'rgba(194,112,62,0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#C2703E',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#3D2B1F',
            titleFont: { family: 'Poppins', size: 12 },
            bodyFont: { family: 'Poppins', size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: ctx => '₹' + ctx.parsed.y.toLocaleString('en-IN'),
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Poppins', size: 11 }, color: '#A89B8C' }
          },
          y: {
            grid: { color: 'rgba(61,43,31,0.05)' },
            ticks: {
              font: { family: 'Poppins', size: 11 },
              color: '#A89B8C',
              callback: v => '₹' + (v / 1000).toFixed(0) + 'k',
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Sales chart error:', err);
  }
}

async function loadCategoryChart() {
  try {
    const data = await AdminAPI.getCategoryChart();
    const ctx = document.getElementById('category-chart').getContext('2d');

    if (data.length === 0) {
      ctx.canvas.parentElement.innerHTML = '<div class="empty-state"><p>No order data yet</p></div>';
      return;
    }

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.category),
        datasets: [{
          data: data.map(d => d.items_sold),
          backgroundColor: chartColors.slice(0, data.length),
          borderWidth: 2,
          borderColor: '#FFFFFF',
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              font: { family: 'Poppins', size: 11 },
              color: '#5C4033',
              usePointStyle: true,
              pointStyleWidth: 8,
            }
          },
          tooltip: {
            backgroundColor: '#3D2B1F',
            titleFont: { family: 'Poppins', size: 12 },
            bodyFont: { family: 'Poppins', size: 12 },
            padding: 12,
            cornerRadius: 8,
          }
        },
        cutout: '65%',
      }
    });
  } catch (err) {
    console.error('Category chart error:', err);
  }
}

async function loadActivity() {
  try {
    const data = await AdminAPI.getActivity(10);
    const feed = document.getElementById('activity-feed');

    if (data.length === 0) {
      feed.innerHTML = '<div class="empty-state"><p>No recent activity</p></div>';
      return;
    }

    feed.innerHTML = data.map(item => {
      const iconType = item.type || 'order';
      const iconSvg = {
        order: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>',
        user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        product: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
        coupon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/></svg>',
      };
      return `
        <div class="activity-item">
          <div class="activity-icon ${iconType}">${iconSvg[iconType] || iconSvg.order}</div>
          <div>
            <div class="activity-text">${item.message}</div>
            <div class="activity-time">${timeAgo(item.created_at)}</div>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('Activity error:', err);
    document.getElementById('activity-feed').innerHTML = '<div class="empty-state"><p>No recent activity</p></div>';
  }
}
