
# This code runs the app

from src.common import create_parser, read_config
from src.app import run_app

# parsed_args = create_parser()  # Create parsed arguments
config = read_config("config.yml")  # Get config data
app = run_app(config)  # Run app including design engine as backend


if __name__ == "__main__":
    # Run app

    app.run_server(host=config["app"]["host"],
                   port=config["app"]["port"])
