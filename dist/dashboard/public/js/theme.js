const THEME_STORAGE_KEY = 'darkMode';
const THEME_TRANSITION_DURATION = 300; // ms

const LIGHT_THEME = {
    'primary': '#7C3AED',
    'background-primary': '#F5F4FB',
    'background-secondary': '#EEEAF8',
    'background-tertiary': '#E6DFF5',
    'text-primary': '#221D38',
    'text-secondary': '#5D5680',
    'text-muted': '#8B84AA',
    'border-color': 'rgba(80, 60, 140, 0.16)',
    'accent-color': '#7C3AED',
    'accent-hover': '#6D28D9',
    'danger-color': '#E11D48',
    'success-color': '#059669'
};

const DARK_THEME = {
    'primary': '#8B5CF6',
    'background-primary': '#0A0813',
    'background-secondary': '#12101F',
    'background-tertiary': '#1A1730',
    'text-primary': '#F4F2FB',
    'text-secondary': '#B8AFD2',
    'text-muted': '#77708F',
    'border-color': 'rgba(181, 155, 255, 0.12)',
    'accent-color': '#A855F7',
    'accent-hover': '#8B5CF6',
    'danger-color': '#FB7185',
    'success-color': '#34D399'
};

function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    const icon = themeToggle.querySelector('i');
    
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const isDark = savedTheme === 'true' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setTheme(isDark);
    
    themeToggle.addEventListener('click', () => {
        const isDarkMode = document.documentElement.classList.contains('dark');
        setTheme(!isDarkMode);
        
        localStorage.setItem(THEME_STORAGE_KEY, (!isDarkMode).toString());
    });
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (localStorage.getItem(THEME_STORAGE_KEY) === null) {
            setTheme(e.matches);
        }
    });
}

function setTheme(isDark) {
    const themeToggle = document.getElementById('themeToggle');
    const icon = themeToggle?.querySelector('i');
    
    if (isDark) {
        document.documentElement.classList.add('dark');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
        applyThemeColors(DARK_THEME);
    } else {
        document.documentElement.classList.remove('dark');
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
        applyThemeColors(LIGHT_THEME);
    }
    
    const event = new CustomEvent('themeChanged', { detail: { isDark } });
    document.dispatchEvent(event);
}

function applyThemeColors(colors) {
    const root = document.documentElement;
    
    Object.entries(colors).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
    });
}

document.addEventListener('DOMContentLoaded', initTheme);

window.themeManager = {
    setTheme,
    isDarkMode: () => document.documentElement.classList.contains('dark'),
    toggleTheme: () => {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(!isDark);
        localStorage.setItem(THEME_STORAGE_KEY, (!isDark).toString());
    }
};

(function() {
    const savedTheme = localStorage.getItem('darkMode');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'true') {
        document.documentElement.classList.add('dark');
    } else if (savedTheme === 'false') {
        document.documentElement.classList.remove('dark');
    } else if (systemPrefersDark) {
        document.documentElement.classList.add('dark');
    }
})();

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    const savedTheme = localStorage.getItem('darkMode');
    
    if (!savedTheme) {
        if (e.matches) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
}); 
