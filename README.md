### Leonardo Generative Design Engine

Generative AI is soooooo hot right now! That is why I desiced to build a generative 3D design engine purely based on basic mathematics (BOOOORING!!!), 100% explainable using 34 parameter. Additionally, a webapp based on Plotly Dash is provided to interact with the engine and to generate 3D designs on the fly. The webapp is deployed to Azure Web Services using GitHub-Actions and can be accessed via the following link: https://leonardoengine.azurewebsites.net/

**Please feel free to download and 3D-print your favorite designs or do some NTF-stuff with it, if this is still on vouge ;)**

**Prerequists**
✅ GIT installed
✅ Python 3.X installed (using Anaconda or Miniconda is recommended)


Clone the repo by executing the following code
```bash
git clone https://github.com/dugi42/leonardo.git
```

 You can create the anaconda environment needed for running the engine from the environment.yml file using the following command in your terminal:
```bash
conda env create -f environment.yml
```

To execute the engine use the following command 
```bash
python3 app.py
```

This runs the webapp on local host on port 8050. You can access the webapp via the following link: http://127.0.0.1:8050
