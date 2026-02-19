require('dotenv').config();

const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('anunciar')
        .setDescription('Criar um anúncio de produto')
        .addStringOption(option =>
            option.setName('nome')
                .setDescription('Nome do produto')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('preco')
                .setDescription('Preço do produto')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('imagem')
                .setDescription('Link da imagem do produto')
                .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Registrando comandos...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );
        console.log('Comandos registrados com sucesso!');
    } catch (error) {
        console.error(error);
    }
})();
