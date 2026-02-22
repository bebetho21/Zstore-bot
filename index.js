const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ChannelSelectMenuBuilder, 
    ChannelType, 
    PermissionFlagsBits,
    ComponentType
} = require('discord.js');

// Configurações principais
const STAFF_ROLE_ID = "1464846409139359784"; // Substitua pelo ID real
const CLIENT_ROLE_ID = "1464846418538926299"; // Substitua pelo ID real
const FEEDBACK_CHANNEL_ID = "1464846455218114683"; // Substitua pelo ID real
const PREFIX = "!";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Memória temporária para o último produto criado
let lastCreatedProduct = null;

client.on('ready', () => {
    console.log(`Bot logado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // !ping
    if (command === 'ping') {
        return message.reply(`🏓 Pong! Latência: ${client.ws.ping}ms`);
    }

    // !say
    if (command === 'say') {
        const text = args.join(" ");
        if (!text) return message.reply("Diga o que eu devo repetir.");
        message.delete().catch(() => {});
        return message.channel.send(text);
    }

    // !embed
    if (command === 'embed') {
        const embed = new EmbedBuilder()
            .setTitle("Exemplo de Embed")
            .setDescription("Este é um comando de exemplo de embed.")
            .setColor("Blue");
        return message.channel.send({ embeds: [embed] });
    }

    // !avatar
    if (command === 'avatar') {
        const user = message.mentions.users.first() || message.author;
        const embed = new EmbedBuilder()
            .setTitle(`Avatar de ${user.username}`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setColor("Random");
        return message.channel.send({ embeds: [embed] });
    }

    // !serverinfo
    if (command === 'serverinfo') {
        const { guild } = message;
        const embed = new EmbedBuilder()
            .setTitle(`Informações do Servidor: ${guild.name}`)
            .setThumbnail(guild.iconURL())
            .addFields(
                { name: "Membros", value: `${guild.memberCount}`, inline: true },
                { name: "Dono", value: `<@${guild.ownerId}>`, inline: true },
                { name: "Criado em", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setColor("Purple");
        return message.channel.send({ embeds: [embed] });
    }

    // !userinfo
    if (command === 'userinfo') {
        const member = message.mentions.members.first() || message.member;
        const embed = new EmbedBuilder()
            .setTitle(`Info de ${member.user.username}`)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: "ID", value: member.id, inline: true },
                { name: "Entrou no Server", value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: "Conta Criada", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setColor("Green");
        return message.channel.send({ embeds: [embed] });
    }

    // !clear
    if (command === 'clear') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply("Você não tem permissão para usar este comando.");
        }
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply("Envie um número entre 1 e 100.");
        
        await message.channel.bulkDelete(amount + 1, true);
        const msg = await message.channel.send(`🧹 Deletei ${amount} mensagens.`);
        setTimeout(() => msg.delete().catch(() => {}), 3000);
        return;
    }

    // !help
    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setTitle("Comandos do Bot")
            .setDescription("Lista de comandos disponíveis:")
            .addFields(
                { name: "Gerais", value: "`ping`, `say`, `embed`, `avatar`, `serverinfo`, `userinfo`, `help`" },
                { name: "Staff", value: "`clear`, `criarproduto`, `enviarproduto`, `cliente @user`" },
                { name: "Outros", value: "`avaliar`" }
            )
            .setColor("Gold");
        return message.channel.send({ embeds: [embed] });
    }

    // !cliente
    if (command === 'cliente') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const target = message.mentions.members.first();
        if (!target) return message.reply("Mencione um usuário.");
        
        await target.roles.add(CLIENT_ROLE_ID).catch(() => {});
        const embed = new EmbedBuilder()
            .setDescription(`✅ O cargo de Cliente foi adicionado para ${target}.`)
            .setColor("Green");
        return message.channel.send({ embeds: [embed] });
    }

    // !criarproduto
    if (command === 'criarproduto') {
        const filter = m => m.author.id === message.author.id;
        try {
            await message.reply("Qual o nome do produto?");
            const nome = (await message.channel.awaitMessages({ filter, max: 1, time: 30000 })).first().content;

            await message.reply("Qual o preço?");
            const preco = (await message.channel.awaitMessages({ filter, max: 1, time: 30000 })).first().content;

            await message.reply("Qual a descrição?");
            const desc = (await message.channel.awaitMessages({ filter, max: 1, time: 30000 })).first().content;

            await message.reply("Qual a URL da imagem?");
            const imgUrl = (await message.channel.awaitMessages({ filter, max: 1, time: 30000 })).first().content;
            if (!imgUrl.startsWith("http")) return message.reply("URL inválida.");

            await message.reply("Quantas variações (1-10)?");
            const varsCount = parseInt((await message.channel.awaitMessages({ filter, max: 1, time: 30000 })).first().content);
            if (isNaN(varsCount) || varsCount < 1 || varsCount > 25) return message.reply("Número inválido.");

            const options = [];
            for (let i = 1; i <= varsCount; i++) {
                options.push({ label: `Produto ${i}`, value: `prod_${i}`, description: `Variação número ${i}` });
            }

            const select = new StringSelectMenuBuilder()
                .setCustomId('select_prod')
                .setPlaceholder('Escolha uma variação')
                .addOptions(options);

            const row1 = new ActionRowBuilder().addComponents(select);
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('buy_btn').setLabel('🛒 Comprar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('info_btn').setLabel('ℹ Informações').setStyle(ButtonStyle.Primary)
            );

            const embed = new EmbedBuilder()
                .setTitle(nome)
                .setDescription(desc)
                .addFields({ name: "Preço", value: preco })
                .setImage(imgUrl)
                .setColor("Blue");

            lastCreatedProduct = { embeds: [embed], components: [row1, row2], data: { nome, preco, desc } };
            return message.reply("✅ Produto criado em memória! Use `!enviarproduto` para postar.");

        } catch (e) {
            return message.reply("Tempo esgotado ou erro na criação.");
        }
    }

    // !enviarproduto
    if (command === 'enviarproduto') {
        if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return message.reply("Apenas STAFF.");
        if (!lastCreatedProduct) return message.reply("Crie um produto primeiro com `!criarproduto`.");

        const select = new ChannelSelectMenuBuilder()
            .setCustomId('select_channel')
            .setChannelTypes([ChannelType.GuildText])
            .setPlaceholder('Selecione o canal para enviar');

        const row = new ActionRowBuilder().addComponents(select);
        return message.reply({ content: "Onde deseja enviar o produto?", components: [row] });
    }

    // !avaliar
    if (command === 'avaliar') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('star_1').setLabel('⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('star_2').setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('star_3').setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('star_4').setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('star_5').setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary)
        );

        return message.reply({ content: "Como você avalia nosso serviço?", components: [row] });
    }
});

// Interactions
client.on('interactionCreate', async (interaction) => {
    // String Select Menu (Variações)
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_prod') {
        await interaction.deferUpdate();
        interaction.client.selectedVar = interaction.values[0];
    }

    // Channel Select Menu (Enviar Produto)
    if (interaction.isChannelSelectMenu() && interaction.customId === 'select_channel') {
        const channelId = interaction.values[0];
        const channel = interaction.guild.channels.cache.get(channelId);
        if (channel) {
            await channel.send({ embeds: lastCreatedProduct.embeds, components: lastCreatedProduct.components });
            return interaction.reply({ content: `✅ Produto enviado em ${channel}!`, ephemeral: true });
        }
    }

    // Buttons
    if (interaction.isButton()) {
        // Info Button
        if (interaction.customId === 'info_btn') {
            const embed = interaction.message.embeds[0];
            return interaction.reply({ content: `ℹ **Descrição:** ${embed.description}`, ephemeral: true });
        }

        // Buy Button (Ticket)
        if (interaction.customId === 'buy_btn') {
            const selected = interaction.client.selectedVar || "Nenhuma variação selecionada";
            const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
            
            const channel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle("Novo Pedido")
                .setDescription(`Usuário: ${interaction.user}\nProduto: ${interaction.message.embeds[0].title}\nVariação: ${selected}\n\nAguarde um ADM responder.`)
                .setColor("Green");

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Fechar Ticket').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ content: `<@&${STAFF_ROLE_ID}>`, embeds: [embed], components: [row] });
            return interaction.reply({ content: `✅ Ticket criado: ${channel}`, ephemeral: true });
        }

        // Close Ticket
        if (interaction.customId === 'close_ticket') {
            if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
                return interaction.reply({ content: "Apenas STAFF pode fechar tickets.", ephemeral: true });
            }
            await interaction.reply("O ticket será deletado em 5 segundos...");
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }

        // Avaliação Stars
        if (interaction.customId.startsWith('star_')) {
            const stars = interaction.customId.split('_')[1];
            await interaction.reply({ content: "Escreva sua avaliação agora no chat:", ephemeral: true });
            
            const filter = m => m.author.id === interaction.user.id;
            const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 60000 });

            collector.on('collect', async (m) => {
                const feedbackChannel = interaction.guild.channels.cache.get(FEEDBACK_CHANNEL_ID);
                if (feedbackChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle("Nova Avaliação")
                        .addFields(
                            { name: "Usuário", value: `${interaction.user.tag}` },
                            { name: "Estrelas", value: "⭐".repeat(parseInt(stars)) },
                            { name: "Comentário", value: m.content }
                        )
                        .setColor("Yellow")
                        .setTimestamp();
                    await feedbackChannel.send({ embeds: [embed] });
                    await m.reply("✅ Obrigado pelo feedback!");
                }
            });
        }
    }
});

client.login(process.env.TOKEN);