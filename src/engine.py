from typing import Tuple
import numpy as np
from scipy import signal
from sklearn.preprocessing import SplineTransformer
import matplotlib.tri as mtri
from stl import mesh

from typing import Tuple
import numpy as np
import matplotlib.tri as mtri


def generate_grid(a_max: float = np.nan, b_max: float = np.nan, num_points: int = 256) -> Tuple[np.ndarray, np.ndarray, mtri.triangulation.Triangulation]:
    """Generates a 2D-grid from 2 max values and returns flattened arrays including triangulation.

    Args:
        a_max (float, optional): Upper limit of first grid component. Defaults to NaN.
        b_max (float, optional): Upper limit of second grid component. Defaults to NaN.
        num_points (int, optional): Number of points per grid component. Defaults to 256.

    Returns:
        Tuple[np.ndarray, np.ndarray, mtri.triangulation.Triangulation]:
        Two flattened arrays from grid including the corresponding triangulation.
    """

    # Generates a linspace array for phi in spherical/cylindrical/etc. coordinates from 0 to two pi
    if np.isnan(a_max):
        a = np.linspace(0, 2 * np.pi * (1+1/num_points),
                        num_points, endpoint=True)
    # Creates a linspace array if a upper limit is given
    else:
        a = np.linspace(0, a_max * (1+1/num_points), num_points, endpoint=True)

    # Generates a linspace array for theta in spherical/cylindrical/etc. coordinates from -pi to pi
    if np.isnan(b_max):
        b = np.linspace(-np.pi, np.pi * (1+1/num_points),
                        num_points, endpoint=True)
    # Creates a linspace array if a upper limit is given
    else:
        b = np.linspace(0, b_max * (1+1/num_points), num_points, endpoint=True)

    a, b = np.meshgrid(a, b)  # Generate meshgrid from linespaces
    a, b = a.flatten(), b.flatten()  # Flatten to array
    triangles = mtri.Triangulation(a, b)  # Create triangles

    return a, b, triangles


def scale_xy(x: np.ndarray, y: np.ndarray, scaler: float = 1.) -> Tuple[np.ndarray, np.ndarray]:
    """Scale x, y coordiantes to scaler value.

    Args:
        x (np.ndarray): x-coordinate of the points.
        y (np.ndarray): y-coordinate of the points.
        scaler (float, optional): Scaler factor. Defaults to 1..

    Returns:
        Tuple[np.ndarray, np.ndarray]: Scaled x- and y-coordinates.
    """

    x *= scaler / np.abs(x).max()
    y *= scaler / np.abs(y).max()

    return x, y


def generate_ellipsoid(theta: np.ndarray, phi: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generates x,y,z-coordinates of an ellipsoid.

    Args:
        theta (np.ndarray): Theta angle used in angular coordinate systems.
        phi (np.ndarray): Theta angle used in angular coordinate systems.

    Returns:
        Tuple[np.ndarray, np.ndarray, np.ndarray]: x,y,z-coordinates of the ellipsoid.
    """

    x = np.cos(phi) * np.sin(theta)
    y = np.sin(phi) * np.sin(theta)
    z = np.cos(theta)

    return x, y, z


def generate_torus(theta: np.ndarray, phi: np.ndarray, r_ratio: float = 0.5) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generates x,y,z-coordinates of a torus.

    Args:
        theta (np.array): Theta angle used in angular coordinate systems.
        phi (np.array): Theta angle used in angular coordinate systems.

    Returns:
        Tuple[np.array, np.array, np.array]: x,y,z-coordinates of the torus.
    """

    x = (1 + r_ratio * np.cos(theta)) * np.cos(phi)
    y = (1 + r_ratio * np.cos(theta)) * np.sin(phi)
    z = np.sin(theta)

    return x, y, z


def generate_spline(array: np.ndarray, order_max: int = 30, knots_max: int = 7, offset: int = 0) -> np.ndarray:
    """Generates a spline transformation from an array.

    Args:
        array (np.ndarray): Input array to be spline transformed.
        order_max (int, optional): Upper limit for spline order (Keep below 50, otherwise super slow!). Defaults to 30.
        knots_max (int, optional): Upper limit for knot order in spline (Keep below 10, otherwise super slow!). Defaults to 7.
        offset (int, optional): Offset value added to spline transform. Defaults to 0.

    Returns:
        np.array: Returns a modulation of the input array by mean of a random spline transform.
    """

    # Generate a random spline order and knot number
    order = np.random.randint(order_max)
    knots = np.random.randint(2, knots_max)

    # Create spline object
    spline = SplineTransformer(knots, order)

    # Get spline transform coefficients
    p = spline.fit_transform(np.expand_dims(array, -1))

    # Create random scale coefficent matrix for each spline coefficents
    A = np.random.uniform(-1, 1, size=(1, p.shape[-1]))
    A = np.repeat(A, len(array), axis=0)

    # Calculate the randum modulator for the input array
    modulator = np.sum(A * p, axis=-1) + offset

    return modulator


def generate_twist(x: np.ndarray, y: np.ndarray, twist_frequency: float, num_points: int = 256) -> Tuple[np.ndarray, np.ndarray]:
    """Generates a rotation for points specified in x and y.

    Args:
        x (np.ndarray): First component of the input array.
        y (np.ndarray): First component of the input array.
        twist_frequency (float): Strength of roation.
        num_points (int, optional): Number of points per grid component. Defaults to 256.

    Returns:
        Tuple[np.array, np.array]: Rotated points as x and y.
    """

    # Choose if rotation is made or not
    rotation_flag = np.random.choice([False, True])
    # Choose if roation is linear or fuzzy (=spline transformed)
    fuzzy_flag = np.random.choice([False, True])

    if rotation_flag:
        # Create linear rotation angle
        alpha = np.linspace(0, 2 * np.pi * twist_frequency,
                            num_points) * np.random.choice([-1, 1])
        # Create copys of array for every point in the grid and flatten
        alpha = np.kron(alpha, np.ones((num_points, 1))).flatten()

        # Create spline transform of angle array
        if fuzzy_flag:
            alpha = generate_spline(alpha)

        # Create copys of x,y to perform roation
        x_temp = x
        y_temp = y

        # Perform rotation
        x = x_temp * np.cos(alpha) - y_temp * np.sin(alpha)
        y = x_temp * np.sin(alpha) + y_temp * np.cos(alpha)

    return x, y


def generate_tilt(x: np.ndarray, y: np.ndarray, z: np.ndarray, x_tilt: float = 1., y_tilt: float = 1.) -> Tuple[np.ndarray, np.ndarray]:
    """Generates a spline transformed shift of x,y-points along a z-dimension.

    Args:
        x (np.ndarray): x-coordinate of the points.
        y (np.ndarray): y-coordinate of the points.
        z (np.ndarray): z-axis along which to generate the tilt.
        x_tilt (float, optional): Tilt factor of x-coordinate of the points. Defaults to 1..
        y_tilt (float, optional): Tilt factor of y-coordinate of the points. Defaults to 1..

    Returns:
        Tuple[np.ndarray, np.ndarray]: Tilted x- and y-coordinates.
    """

    # Generate splines and tilt x,y
    x += x_tilt * generate_spline(z)
    y += y_tilt * generate_spline(z)

    return x, y


def generate_edginess(array: np.ndarray, angle: np.ndarray, edginess: float = 0.) -> Tuple[np.ndarray, np.ndarray]:
    """Generates edginess from an input array by means of Lamé curve.

    Args:
        array (np.ndarray): Input array which is transformed.
        angle (np.ndarray): Input angle which describes the
                          rotation along the edginess tranformation.
        edginess (float, optional): Edginess factor. Defaults to 0..

    Returns:
        Tuple[np.array, np.array]: Lame tranformed x- and y-arrays.
    """

    x = array * np.sign(np.cos(angle)) * \
        np.abs(np.cos(angle)) ** (1 / (1 + edginess))

    y = array * np.sign(np.sin(angle)) * \
        np.abs(np.sin(angle)) ** (1 / (1 + edginess))

    return x, y


def generate_modulator(array: np.ndarray, scaler: float = 1, offset: int = 0) -> np.ndarray:
    """Generate scaled spline transformed modulator.

    Args:
        array (np.array): Input array which needs to be spline transformed and scaled.
        scaler (float, optional): Scaler factor. Defaults to 1.
        offset (float, optional): Offset value adde to spline transform. Defaults to 0.

    Returns:
        np.array: Returns scaled spline transformed array.
    """

    # Gernerate modulator by spline transformed array
    modulator = generate_spline(array, offset=offset)

    # Scale modulator to scaler
    modulator /= modulator.max()
    modulator *= scaler

    return modulator


def generate_texture(array: np.ndarray, texture_type: int = 0, amplitude: float = 0.1, frequency: float = 1., duty_cycle: float = 0.5) -> np.ndarray:
    """Generate surface texture from input array which are 
       generated by a sine-, sawtooth-, square- and gausspulse function (Encoding = 0, 1, 2, 3).

    Args:
        array (np.ndarray): Input array which is used to generate feature.
        texture_type (int, optional): Choose feature type. Defaults to 0.
        amplitude (float, optional): Feature amplitude. Defaults to 0.1.
        frequency (float, optional): Freature frequency. Defaults to 1..
        duty_cycle (float, optional): If needed feature duty cycle. Defaults to 0.5.

    Returns:
        np.ndarray: Return surface texture from input array. 
    """

    # Init feature
    texture = np.ones(len(array))

    # Sine texture
    if texture_type == 0:
        texture += amplitude * np.sin(frequency * array)
    # Sawtooth texture
    elif texture_type == 1:
        texture += amplitude * \
            signal.sawtooth(frequency * array, duty_cycle)  # type: ignore # there seems to be datatype bug in scipy
    # Square texture
    elif texture_type == 2:
        texture += amplitude * \
            signal.square(frequency * array, duty_cycle)
    # Gausspulse texture
    elif texture_type == 3:
        texture += amplitude * \
            signal.gausspulse(frequency * array, fc=np.random.randint(2, 20)) # type: ignore # there seems to be datatype bug in scipy

    return texture


def generate_angular_texture(theta: np.ndarray, phi: np.ndarray, parameters: dict) -> dict:
    """Generates random angular textures.

    Args:
        theta (np.ndarray): Theta angle used in angular coordinate systems.
        phi (np.ndarray): Theta angle used in angular coordinate systems.
        parameters (dict): Configuration paramters from yaml-file.

    Returns:
        dict: Texture dictionary for each feature.
    """

    # Create angle list an labels
    anlges = [theta, phi]
    labels = ["theta", "phi"]

    # Create coordiante labels
    coordinate_labels = ["x", "y", "z"]

    # Init dict
    textures = {}
    # Create textures along coordinates
    for f in coordinate_labels:
        # Randomly choose angle along the texture propagates
        ridx = np.random.randint(2)
        label = labels[ridx]
        # Generate texture from config
        texture = generate_texture(
            array=anlges[ridx],
            texture_type=parameters[f"{label}_texture_type"],
            amplitude=parameters[f"{label}_amplitude"],
            frequency=parameters[f"{label}_frequency"],
            duty_cycle=parameters[f"{label}_duty_cycle"],
        )

        # Scale
        texture *= parameters[f"{f}_scaler"]
        # Write to dict
        textures[f] = texture

    return textures


def design_rsym(parameters: dict) -> Tuple[np.ndarray, np.ndarray, np.ndarray, mtri.triangulation.Triangulation]:
    """Generates a desgin based on ellipsoid or torus coordiantes
       which are randomly transform by parameters specified in the config yaml.

    Args:
        parameters (dict): Randomly generated parameter space.

    Returns:
        Tuple[np.array, np.array, np.array, mtri.triangulation.Triangulation]:
        x,y,z- coordinates of the design as well as the corresponding trianglations.
    """
    # Print design type
    print("Design type: RSYM")

    # Generate grid used in for angular coordinate systems
    theta, phi, triangles = generate_grid(num_points=parameters["num_points"])

    # Randomly pick ellipsoid or torus base design
    ridx = np.random.randint(2)
    if ridx == 0:
        x, y, z = generate_ellipsoid(theta, phi)
    else:
        x, y, z = generate_torus(theta, phi, parameters["r_ratio"])

    # Generate angular textures
    textures = generate_angular_texture(theta, phi, parameters)

    # Transform x,y,z corrdinates
    x *= textures["x"]
    y *= textures["y"]
    z *= textures["z"]

    # Generate roations along the e1,e2,e3 unit vectors
    x, y = generate_twist(
        x, y, parameters["e1_twist"], num_points=parameters["num_points"])
    x, z = generate_twist(
        x, z, parameters["e2_twist"], num_points=parameters["num_points"])
    y, z = generate_twist(
        y, z, parameters["e3_twist"], num_points=parameters["num_points"])

    return x, y, z, triangles


def design_csym(parameters: dict) -> Tuple[np.ndarray, np.ndarray, np.ndarray, mtri.triangulation.Triangulation]:
    """Generates a desgin based on cylindrical coordiantes
       which are randomly transform by parameters specified in the config yaml.

    Args:
        parameters (dict): Randomly generated parameter space.

    Returns:
        Tuple[np.array, np.array, np.array, mtri.triangulation.Triangulation]:
        x,y,z- coordinates of the design as well as the corresponding trianglations.
    """
    # Print design type
    print("Design type: CSYM")

    # Generate grid used in for cylindrical coordinate systems
    z, phi, triangles = generate_grid(
        a_max=parameters["height"],
        num_points=parameters["num_points"]
    )

    # Generate base design radius modulator as a function of the z-axis
    modulator = generate_modulator(
        z, parameters["radius"],
        offset=parameters["radius_offset"]
    )

    # Generate texture alone phi angle
    modulator *= generate_texture(
        array=phi,
        texture_type=parameters["phi_texture_type"],
        amplitude=parameters["phi_amplitude"],
        frequency=parameters["phi_frequency"],
        duty_cycle=parameters["phi_duty_cycle"],
    )

    # Generate texture alone the z-axis
    modulator *= generate_texture(
        array=parameters["height"] / (2 * parameters["radius"] * np.pi) * z,
        texture_type=parameters["z_texture_type"],
        amplitude=parameters["z_amplitude"],
        frequency=parameters["z_frequency"],
        duty_cycle=parameters["z_duty_cycle"],
    )

    x, y = generate_edginess(modulator, phi, parameters["edginess"])

    x, y = generate_twist(
        x, y, parameters["twist"], parameters["num_points"])

    x, y = generate_tilt(x, y, z, parameters["tilt_x"], parameters["tilt_y"])

    x, y = scale_xy(x, y, parameters["radius"])

    return x, y, z, triangles


def generate_parameters(config: dict, model: str = "csym") -> dict:
    """
    Generate a dictionary of parameters for a given model based on a configuration dictionary.

    Args:
        config (dict): A dictionary containing configuration information for the model.
        model (str): The name of the model to generate parameters for. Defaults to "csym".

    Returns:
        dict: A dictionary containing the generated parameters for the model.
    """
    
    # Init dict
    parameters = {}

    # Generate random parameter from list or value
    for key, val in config["models"][model]["parameters"].items():
        if isinstance(val, list):
            parameters[key] = np.random.uniform(val[0], val[1])
        else:
            parameters[key] = val

    # Add phi texture type
    parameters["phi_texture_type"] = np.random.randint(
        config["models"][model]["num_texture_types"])

    # Add z texture type in case of cylindrical coordinates
    if model == "csym":
        parameters["z_texture_type"] = np.random.randint(
            config["models"][model]["num_texture_types"])

    # Add theta texture time in case of angular coordinates
    elif model == "rsym":
        parameters["theta_texture_type"] = np.random.randint(
            config["models"][model]["num_texture_types"])

    return parameters


def design(config: dict, model: str = "csym") -> Tuple[np.ndarray, np.ndarray, np.ndarray, mtri.triangulation.Triangulation]:
    """Desgins a specifed model based on a configuration space provides in the yaml file.

    Args:
        config (dict): Config of the paramter space read from the yaml file.
        model (str, optional): Specifies the model string (csym or rsym). Defaults to "csym".

    Returns:
        Tuple[np.array, np.array, np.array, mtri.triangulation.Triangulation]:
        x,y,z- coordinates of the design as well as the corresponding trianglations.
    """

    # Generates a random set of parameters within
    # a the specified paramter space taken from the config yaml-file.
    parameters = generate_parameters(config, model)

    # Generate coordinates and trinagles
    x, y, z, triangles = globals()[f"design_{model}"](parameters)

    return x, y, z, triangles


def get_ijk(triangles: mtri.triangulation.Triangulation) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Get the vertex indices.

    Args:
        triangles (mtri.triangulation.Triangulation): Triangles from trianglulation

    Returns:
        Tuple[np.ndarray, np.ndarray, np.ndarray]: vertex indices of x,y,z-coordinates.
    """

    i, j, k = triangles.triangles[:, 0], triangles.triangles[:, 1], triangles.triangles[:, 2]

    return i, j, k


@staticmethod
def export_stl(path: str, x: np.ndarray, y: np.ndarray, z: np.ndarray, triangles: mtri.triangulation.Triangulation):
    """Exports a STL file from a generated desgin.

    Args:
        path (str): Path to file location.
        x (np.ndarray): x-coordinates of the points of the design.
        y (np.ndarray): y-coordinates of the points of the design.
        z (np.ndarray): z-coordinates of the points of the design.
        triangles (mtri.triangulation.Triangulation): Correspoinding triangulation.
    """

    # Create mesh
    design_mesh = mesh.Mesh(
        np.zeros(len(triangles.triangles), dtype=mesh.Mesh.dtype), remove_empty_areas=False)

    # Create x,y,z components of the mesh
    design_mesh.x[:] = x[triangles.triangles]
    design_mesh.y[:] = y[triangles.triangles]
    design_mesh.z[:] = z[triangles.triangles]

    design_mesh.save(path)
