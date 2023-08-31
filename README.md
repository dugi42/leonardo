# Leonardo Generative Design Engine

<span style="font-size:small;">
Daniel Hauser

LinkedIn: https://www.linkedin.com/in/daniel-hauser-77259a159/
GitHub: **https://github.com/dugi42/**
</span>

**TL;DR**
Generative AI is soooooo hot right now! That is why I desiced to build a generative 3D design engine purely based on basic mathematics (BOOOORING!!!), 100% explainable using 34 parameter. Additionally, a webapp based on Plotly Dash is provided to interact with the engine and to generate 3D designs on the fly. The webapp is deployed to Azure Web Services using GitHub-Actions and can be accessed via the following link: https://leonardoengine.azurewebsites.net/

**Please feel free to download and 3D-print your favorite designs or do some NTF-stuff with it, if this is still on vouge ;)**

## 0. Clone, install and run Leonardo on local host
**Prerequists**
✅ Python 3.X installed (using Anaconda or Miniconda is recommended)
✅ GIT installed
✅ Hungry for awesome 

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


## 1. Motivation
The motivation for this projects goes back to my time as a Tech Lead being part of a great team pioniering 3D-printing of glass. We needed to generated different 3D-objects to explore and probe the high-dimensional parameter space of our manifacturing process. To overcome the timedemanding and manual 3D-design process I developed an infancy design tool which was purly based on cylinder symetric 3D-designs. Years later and as a side project I have descided to restart this project and generalized the design capabilities by introducting rotational symetric design elements. The image below shows nine randomly generated 3D designs.

<div style="background-color: white; padding: 10px;">
  <img src="imgs/sample02.jpg" alt="Alt text" style="width: 50%; height: auto;">
</div>

*Claude Elwood Shannon*, the father of information theory concluded that **information is surprise**. Only when we are surprised, we will learn something profound and important about the underlying dynamics and laws of nature! This is also applicable in the context of arts & design since these disciplines meet at the intersection of control and accident leading to surprise.

**So fasten your seatbelts ladies and gents, because you will see some freaky linear algebra combined with nasty functions all wrapped up in pure Python 🤓**

## 2. The math behind the Leonardo Engine

This chapter will illuminate some light on the thoughts and concepts behind the engine. I am not claiming that this approach is the most elegant one, but it does the job. Suggestions for improvements are warmly welcome! All details can be found in the doc-strings and comments within `engine.py` module.

### 2.0. Coordinate systems
The engine is based on three different coordinate systems: cylindrical, spherical, and torus coordinates. The subchapters below are quickly reviewing the basics of these coordinate systems.

#### 2.0.1. Cylindrical Coordinates

Cylindrical coordinates can be related to Cartesian coordinates using the following equations:

$$
x = r \cdot \cos(\varphi)\\
y = r \cdot \sin(\varphi)\\
z = z 
$$


Where $r$ is the distance from the origin in the xy-plane, $\varphi$ is the angle from the positive x-axis, and $z$ is the height above the xy-plane.

#### 2.0.2. Spherical Coordinates

Spherical coordinates can be related to Cartesian coordinates using the following equations:

$$
x = r \cdot \cos(\varphi) \cdot \sin(\theta)\\
y = r \cdot \sin(\varphi) \cdot \sin(\theta)\\
z = r \cdot \cos(\theta)
$$

Where $r$ is the distance from the origin, $\varphi$ is the angle in the xy-plane, and $\theta$ is the angle from the positive z-axis.

#### 2.0.3. Torus Coordinates

Torus coordinates are a bit more complex to relate to Cartesian coordinates due to the torus' curved geometry. They are given by:

$$
x = (R + r \cdot \cos(\theta)) \cdot \cos(\varphi)\\
y = (R + r \cdot \cos(\theta)) \cdot \sin(\varphi)\\
z = r \cdot \sin(\theta)
$$

Where $$R$ is the major radius, $r$ is the minor radius, $\theta$ is the azimuthal angle, and $\varphi$ is the angle in the xy-plane.

These equations allow us to translate points between the cylindrical, spherical, and torus coordinate systems and the familiar Cartesian coordinate system.


### 2.1. Grid generation

To generate a grid of points, we need to define the number of points in each dimension. Thus we will choose a 2D-grid which in the case of spherical coordinates will consist of two angles $(\varphi, \theta) \in [0, 2\pi[ \times [0, \pi]$. The grid is generated by the `generate_grid()` function in the `engine.py` module.
The grid is generated by the following code snippet:

```python
a, b = np.meshgrid(a, b)  # Generate meshgrid from linespaces
a, b = a.flatten(), b.flatten()  # Flatten to array
triangles = mtri.Triangulation(a, b)  # Create triangles
```

The `a` and `b` variables are the linespaces for the angles $\varphi$ and $\theta$ respectively. 
Once the grid is passed into the formulas for the described coordinate systems, $(x, y, z)$ coordiantes can be calculated for each point in the grid along with the corresponding triangulation. It's important to notice, that

The `triangles` variable is a `matplotlib.tri.Triangulation` object which is used to generate the 3D mesh. It's possible to pass the `triangles` object alongside the corresponding $(x,y,z)$ coordinates e.g. to the `plot_trisurf()` function of the `matplotlib` module to generate the 3D mesh or in this case to pass the `triangles` object to the `plotly` `graph_objs.Mesh3d` object to generate the 3D mesh. Using `plotly` for 3D visualization is a bit more convenient since it allows to interact with the 3D mesh and to rotate it in the browser. It also requires extraction of the vertix indicesfrom the `triangles` object. This is done by `get_ijk()` function in the `engine.py` module.


### 2.2. Transformations: Twist, Tilt & Edginess
Twisting and tilting are essential transformations for generating interesting 3D designs. The following subchapters will explain the math behind these transformations.

#### 2.2.1. Twist Transformation

To rotate a point $P(x, y, z)$ counterclockwise by an angle $\alpha$ about the z-axis, the rotation matrix is:

$$
R_z(\alpha) = 
\begin{bmatrix}
    \cos(\alpha) & -\sin(\alpha) & 0\\
    \sin(\alpha) & \cos(\alpha) & 0\\
    0 & 0 & 1
\end{bmatrix}
$$

The new coordinates $P'(x', y', z')$ can be found by multiplying the rotation matrix by the original coordinates:

$$
\begin{bmatrix}
    x' \\
    y' \\
    z'
\end{bmatrix}=
R_z(\theta)
\begin{bmatrix}
    x \\
    y \\
    z
\end{bmatrix}
$$

To rotate all $(x, y)$ coordinates generated from the 2D-grid by an angle $\alpha$ about the z-axis, the function `generate_twist()` from the `engine.py` module is used. 

To create an alternation (back- & forth) in rotation, the twist angle can be transformed by Spline Transformation of a random degree and random number of knots. The `generate_twist()` function from the `engine.py` module is using the `sklearn.preprocessing.SplineTranformer` function wraped in the function `generate_split` to generate random B-spline bases for the features. There is no particular reason why I have chosen B-splines, it just works.

#### 2.2.2. Tilt Transformation

The tilt transformation is a bit more complex than the twist transformation. It is based on the concept of gnerating univariate B-spline bases for features. `sklearn` provides a convenient function for generating B-spline bases, namely `sklearn.preprocessing.SplineTranformer`. The `generate_tilt()` function from the `engine.py` module is using the function `generate_spline` to generate random B-spline bases for the features. There is no particular reason why I have chosen B-splines, it just works. 

#### 2.2.3. Edginess aka Lamé curve

Transforming an ellipse into a rectangle or superellipse and vice versa is a very powerful transformation. It is based on the Lamé curve aka Superellipse which is given by:

$$
r = \left( \left| \frac{x}{a} \right|^n + \left| \frac{y}{b} \right|^n \right)^{1/n}
$$

By choosing $n$ carefully, the Lamé curve can be transformed into a circle, an ellipse, a rectangle, or a square. The `generate_edginess()` function from the `engine.py` module is using the Lamé equation to transform the grid of points into a rectangle.

<div style="background-color: #FFFFFF; padding: 10px;">
  <img src="imgs/superellipse.png" alt="Alt text" style="width: 50%; height: auto;">
</div>

*Superellipse examples taken from [Wikipedia](https://en.wikipedia.org/wiki/Superellipse)*



### 2.3. Adding modulation and texture

Modulation and texture are used to further enhance the design. The subchapters below will explain the math behind these transformations.

#### 2.3.1. Modulation

The function `generate_modulation()` from the `engine.py` module is used to modulate the grid of points again using random spline transformation. Each coordinate of all points generated can be transformed accordingly. This allows for a wide range of modulation effects in each spatial dimension.

#### 2.3.2. Texture

The function `generate_texture()` from the `engine.py` module is used to apply texture to each coordinate of all points generated. The following functions can be applied to each coordinate with a defined set of parameters to generate different textures:
1. Sinusoidal function
2. Sawtooth function
3. Square function
4. Gaussian Pulse function
  
The function `generate_angular_texture` from the `engine.py` modul than applies the texture transformations on the angles $\varphi$ and $\theta$ in case of the spherical coordinate system. The range and specifications of the texture transformations can be defined in the `config.yml` file.

## 3. Design process

There are two design modes. Designs based on cylindrical coordinates and designs based on spherical coordinates. The design processes excecuted by the `design()` function with in the `engine.py` modul are quiet similar for both modes. The following steps are excuted in the design a 3D object:

1. Random choice of design mode (cylindrical or spherical)
2. Generate random parameters from the `config.yml` file
3. Generate a grid of points based on the chosen design mode and random parameters
4. Dependent on the design mode, generate the following transformations on the corresponding coordinates:
   a. modulations and textures 
   b. the edginess 
   c. twist and tilt
5. sclae the coordinates to the desired size

Everytime the design button in the WebApp build in Plotly Dash is clicked, this design process is executed and a new 3D design is generated. A desired design can simply be downloaded as a `export.stl` file and 3D-printed or some NTF stuff with it, if this is still on vouge ;).

## 4. Deployment to Azure Web Services

The WebApp is deployed to Azure Web Services using GitHub-Actions. If you are interested in deploying a Python WebApp to Azure Web Services using GitHub-Actions, follow these steps:

1. Create a Azure Account at portal.azure.com
2. Create a Subscription and a Resource Group
3. Create a WebApp Service Plan and a WebApp
4. Create a Deployment User and a Deployment Credential
5. Create a GitHub-Secrets for the Deployment Credential and the Deployment User
6. Create a GitHub-Actions workflow
7. Push the code to the GitHub repository
8. Check the deployment status in the Azure Portal
9. Access the WebApp via the URL provided in the Azure Portal
10. Enjoy your WebApp ;)




-   



## 5. Outlook $\rightarrow$ Towards a "Tinder-like" human-in-the-loop design machine ❤️

It would be great to collaborate with someone interested on this project. I am looking forward to your feedback and suggestions for improvements. Please feel free to contact me via LinkedIn or GitHub.

### 5.1. Refactor code
The code is not very well structured and needs to be refactored. I am planning to do this in the near future. I am also planning to add some unit tests to the code.

### 5.2. Add tests to CI/CD pipelines
I am planning to add some tests to the CI/CD pipelines. This will be done in the near future.

### 5.2. Human-in-the-loop design exploration
 It would be great to add some human-in-the-loop action to the engine. Why do I blieve this is interesintg? Well, I think that the engine is capable of generating a wide range of interesting 3D designs. However, the engine is only capable of generating random design which might not be appealing to the human eye. This is where the human-in-the-loop comes into play. The human-in-the-loop can be used to select the most appealing designs and to use them as a starting point for further design exploration. This can be done by using the `design()` function with in the `engine.py` modul. The `design()` function takes a `design_mode` argument which can be set to `cylindrical` or `spherical`. The `design()` function also takes a `design_params` argument which is a dictionary containing the design parameters. The `design_params` dictionary can be used to set the design parameters to the values of the most appealing design. The `design()` function will then generate a new design based on the most appealing design. This process can be repeated until the most appealing design is found. This is a very simple approach to human-in-the-loop design exploration. However, it is a very powerful one since it allows to explore the high-dimensional and highly correleated design space in a very efficient way.

 Some simple methods which come into my mind would be dimensionality reduction methods like Autoencoders. More advanced methods would be Generative Adversarial Nets, Bayesian Optimization or Reinforcement Learning. I am looking forward to implement some of these methods in the future.