import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

sns.set_style('whitegrid')
sns.set_palette('colorblind')

x = np.linspace(-1, 1, 1000)
y = np.linspace(-1, 1, 1000)

alpha = np.linspace(0, 2 * np.pi, 1000)
a = 2
b = 1

ns = [0.1, 0.4, 0.5, 1, 1.5, 3, 5, 20]
fig, ax = plt.subplots(figsize=(6, 6))
for n in ns:
    x = a * np.sign(np.cos(alpha)) * np.abs(np.cos(alpha)) ** (2 / n)
    y = b * np.sign(np.sin(alpha)) * np.abs(np.sin(alpha)) ** (2 / n)
    
    ax.plot(x, y, label=f'n={n}')

ax.axis('equal')
ax.axis('off')
ax.legend()
sns.despine()
plt.tight_layout()
plt.show()