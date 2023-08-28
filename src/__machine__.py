"""Please ignore! Just some crazy stuff ;) Don't try to understand it!"""

# 
# 
# from tensorflow.keras.preprocessing import image
# import yaml
# import tensorflow
# from tensorflow.keras.layers import Input, Conv2D, MaxPooling2D, BatchNormalization, Dropout, Flatten, Dense, Lambda, \
#     Reshape, Conv2DTranspose, Activation, LeakyReLU

# from tensorflow.keras.models import Model
# from tensorflow.keras import backend as K

# from tensorflow.keras.metrics import binary_crossentropy

# import os
# import numpy as np

# from tensorflow.keras.preprocessing.image import load_img, img_to_array

# import matplotlib.pyplot as plt

# def sampling(args):
#     mu, log_var = args
#     epsilon = K.random_normal(shape=K.shape(mu), mean=0, stddev=1.)
#     return mu + K.exp(log_var / 2) * epsilon

# def read_config(path):
#     with open(path, "r") as f:
#         config_vae = yaml.load(f)
#     config = []
#     for key0 in config_vae.keys():
#         locals()[key0] = []

#         for key1 in config_vae[key0].keys():
#             locals()[key0].append(config_vae[key0][key1])
#         config.append(locals()[key0])
#     return config

# def read_images(path="data/images/train", num_images=5000, rescale = 255.):
#     files = os.listdir(path)
#     images = []
#     for i in range(num_images):
#         image = load_img(os.path.join(path, files[i]))
#         images.append(img_to_array(image))
#     return np.stack(images) / rescale


# def variantional_auto_encoder(path):
#     config = read_config(path)

#     encoder_input = Input(config[0][0], name="encoder_input")
#     filters, kernel_size, strides, paddings, pool_flag, batch_flag, dropout_flag, dropout_rates = config[0][1:]

#     x = encoder_input

#     for f, k, s, p, d in zip(filters, kernel_size, strides, paddings, dropout_rates):
#         x = Conv2D(
#             filters=f,
#             kernel_size=k,
#             strides=s,
#             padding=p,
#         )(x)

#         if pool_flag:
#             x = MaxPooling2D()(x)

#         if batch_flag:
#             x = BatchNormalization()(x)

#         if dropout_flag:
#             x = Dropout(d)(x)

#         x = LeakyReLU()(x)

#     shape_before_flattening = K.int_shape(x)[1:]
#     x = Flatten()(x)
#     x = Dense(32)(x)

#     z_mu_layer = Dense(config[1][0], name="mu")(x)
#     z_log_var_layer = Dense(config[1][0], name="log_var")(x)

#     encoder_output = Lambda(sampling, name="Encoder_Output")([z_mu_layer, z_log_var_layer])

#     encoder = Model(encoder_input, encoder_output, name='encoder')
#     encoder.summary()

#     filters, kernel_size, strides, paddings, batch_flag, dropout_flag, dropout_rates = config[2]

#     decoder_input = Input(shape=config[1][0], name="decoder_input")    
#     x = Dense(np.prod(shape_before_flattening))(decoder_input)
#     x = Reshape(shape_before_flattening)(x)

#     for f, k, s, p, d in zip(filters, kernel_size, strides, paddings, dropout_rates):
#         x = Conv2DTranspose(
#             filters=f,
#             kernel_size=k,
#             strides=s,
#             padding=p,
#         )(x)

#         if batch_flag:
#             x = BatchNormalization()(x)

#         if dropout_flag:
#             x = Dropout(rate=d)(x)

#         x = LeakyReLU()(x)

#     x = Conv2DTranspose(
#         filters=config[0][0][-1],
#         kernel_size=kernel_size[-1],
#         strides=strides[-1],
#         padding=paddings[-1],
#     )(x)

#     x = Activation("sigmoid")(x)
#     decoder_output = x

#     decoder = Model(decoder_input, decoder_output, name='decoder')
#     decoder.summary()

#     vae = Model(encoder_input, decoder(encoder_output))

#     vae.compile(optimizer=config[3][0], loss="binary_crossentropy", metrics=[rmse])

#     train_data = read_images(num_images=500)
#     train_data /= 255.0


#     epochs, batch_size, shuffle, validation_split = config[4]
#     vae.fit(train_data, train_data, epochs=epochs, batch_size=batch_size,
#             shuffle=shuffle, validation_split=validation_split)

#     decoder.save_model("decoder.h5")

#     num_samples=15
#     figure = np.zeros(
#         (config[0][0][0] * num_samples, config[0][0][1] * num_samples, config[0][0][2]))

#     # Create a Grid of latent variables, to be provided as inputs to decoder.predict
#     # Creating vectors within range -5 to 5 as that seems to be the range in latent space
#     grid_x = np.linspace(-5, 5, num_samples)
#     grid_y = np.linspace(-5, 5, num_samples)[::-1]

#     # decoder for each square in the grid
#     for i, yi in enumerate(grid_y):
#         for j, xi in enumerate(grid_x):
#             z_sample = np.array([[xi, yi]])
#             x_decoded = decoder.predict(z_sample)
#             digit = x_decoded[0].reshape(config[0][0])
#             figure[i * config[0][0][0]: (i + 1) * config[0][0][0],
#             j * config[0][0][1]: (j + 1) * config[0][0][1]] = digit

#     plt.figure(figsize=(10, 10))
#     # Reshape for visualization
#     fig_shape = np.shape(figure)
#     figure = figure.reshape((fig_shape[0], fig_shape[1]))

#     plt.imshow(figure, cmap='gnuplot2')
#     plt.show()
#     return vae


# def rmse(y_true, y_pred):
#         return K.sqrt(K.mean(K.square(y_true - y_pred), axis=[1, 2, 3]))
