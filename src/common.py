import argparse
import yaml
import argparse


def create_parser() -> argparse.Namespace:
    """
    Creates a parser to parse command line arguments.

    Returns:
        argparse.Namespace: The parsed arguments.
    """
    # Create parser
    parser = argparse.ArgumentParser(
        description='Specify configs for design engine app')

    # Add arguments
    parser.add_argument('-c',
                        '--config',
                        type=str,
                        help='Path to configuration yaml-file.')

    # Parse arguments
    arguments = parser.parse_args()
    return arguments


def read_config(path: str) -> dict:
    """Reads the config yaml file and returns a dictionary

    Args:
       path (str): Path to config yaml file

    Returns:
       dict: Contains the configuration for the design engine and the dash app
    """
    # open yaml config file
    config = {}
    with open(path, "r") as file:
        config = yaml.safe_load(file)

    return config
