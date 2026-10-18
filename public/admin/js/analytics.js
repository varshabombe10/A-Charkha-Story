document.addEventListener('DOMContentLoaded', async () => {
  const admin = await checkAdminAuth();
  if (!admin) return;

  loadAnalytics('daily');

  document.querySelectorAll('.revenue-period').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.revenue-period').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      loadAnalytics(e.target.dataset.period);
    });
  });
});

let revenueChartInstance = null;
let fabricChartInstance = null;
let userGrowthChartInstance = null;

async function loadAnalytics(period) {
  try {
    const [revenueRaw, products, fabrics, users] = await Promise.all([
      AdminAPI.getRevenue(period),
      AdminAPI.getTopProducts(),
      AdminAPI.getFabricPerformance(),
      AdminAPI.getUserGrowth(),
    ]);

    // Format revenue data
    // Group by period depending on 'daily', 'weekly', 'monthly'
    // Server currently groups by date (YYYY-MM-DD)
    const revData = processRevenue(revenueRaw, period);
    renderRevenueChart(revData.labels, revData.data);

    renderTopProducts(products);
    renderFabricChart(fabrics);
    renderUserGrowthChart(users);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function processRevenue(raw, period) {
  if (!raw.length) return { labels: [], data: [] };
  
  if (period === 'monthly') {
    const grouped = {};
    raw.forEach(row => {
      const d = new Date(row.date);
      const k = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      grouped[k] = (grouped[k] || 0) + row.revenue;
    });
    return { labels: Object.keys(grouped), data: Object.values(grouped) };
  }
  
  return {
    labels: raw.map(r => new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })),
    data: raw.map(r => r.revenue)
  };
}

function renderRevenueChart(labels, data) {
  const ctx = document.getElementById('revenue-chart').getContext('2d');
  
  if (revenueChartInstance) {
    revenueChartInstance.destroy();
  }

  revenueChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data,
        borderColor: '#C2703E',
        backgroundColor: 'rgba(194,112,62,0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#C2703E',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
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
          callbacks: { label: ctx => '₹' + ctx.parsed.y.toLocaleString('en-IN') }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 11 }, color: '#A89B8C' } },
        y: { 
          grid: { color: 'rgba(61,43,31,0.05)' }, 
          ticks: { font: { family: 'Poppins', size: 11 }, color: '#A89B8C', callback: v => '₹' + v.toLocaleString() }
        }
      }
    }
  });
}

function renderTopProducts(products) {
  const tbody = document.getElementById('top-products-table');
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><p>No data</p></div></td></tr>';
    return;
  }
  
  tbody.innerHTML = products.map(p => `
    <tr>
      <td class="fw-600">${p.name}</td>
      <td>${p.category}</td>
      <td>${p.total_sold} units</td>
      <td class="fw-700" style="color:var(--color-terracotta);">${formatPrice(p.total_revenue)}</td>
    </tr>
  `).join('');
}

function renderFabricChart(fabrics) {
  const ctx = document.getElementById('fabric-chart').getContext('2d');
  
  if (fabricChartInstance) {
    fabricChartInstance.destroy();
  }

  if (fabrics.length === 0) {
    ctx.canvas.parentElement.innerHTML = '<div class="empty-state"><p>No data</p></div>';
    return;
  }

  fabricChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: fabrics.map(f => f.fabric_type),
      datasets: [{
        data: fabrics.map(f => f.items_sold),
        backgroundColor: chartColors.slice(0, fabrics.length),
        borderWidth: 2,
        borderColor: '#FFFFFF',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { family: 'Poppins', size: 11 }, usePointStyle: true, padding: 16 } },
      },
      cutout: '60%',
    }
  });
}

function renderUserGrowthChart(users) {
  const ctx = document.getElementById('user-growth-chart').getContext('2d');
  
  if (userGrowthChartInstance) {
    userGrowthChartInstance.destroy();
  }

  if (users.length === 0) {
    ctx.canvas.parentElement.innerHTML = '<div class="empty-state"><p>No data</p></div>';
    return;
  }

  userGrowthChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: users.map(u => {
        const d = new Date(u.month + '-01');
        return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      }),
      datasets: [{
        label: 'New Users',
        data: users.map(u => u.new_users),
        backgroundColor: '#8B9A6B',
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#3D2B1F', titleFont: { family: 'Poppins' }, bodyFont: { family: 'Poppins' } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 11 }, color: '#A89B8C' } },
        y: { 
          grid: { color: 'rgba(61,43,31,0.05)' }, 
          ticks: { font: { family: 'Poppins', size: 11 }, color: '#A89B8C', stepSize: 1 }
        }
      }
    }
  });
}
