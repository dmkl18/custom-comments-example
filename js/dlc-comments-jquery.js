var CommentsApp = CommentsApp || {};

(function() {

    "use strict";

    var ModalDLC = function(modalBlock, modalClass) {
        this.modalClass = modalClass;
        this.modal = modalBlock.getElementsByClassName(modalClass)[0];
        var baseClass = this.modal.getAttribute("class"),
            confirmButtons = this.modal.getElementsByClassName(ModalDLC.CONFIRM_MODAL_CLASS),
            cancelButtons = this.modal.getElementsByClassName(ModalDLC.CANCEL_MODAL_CLASS);
        if(baseClass && baseClass.indexOf(ModalDLC.HIDE_MODAL_CLASS) === -1) {
            this.modal.setAttribute("class", baseClass + " " + ModalDLC.HIDE_MODAL_CLASS);
        }
        this.events(confirmButtons, cancelButtons);
    };

    ModalDLC.HIDE_MODAL_CLASS = "hide-modal";
    ModalDLC.CONFIRM_MODAL_CLASS = "modal-btn-confirm";
    ModalDLC.CANCEL_MODAL_CLASS = "modal-btn-cancel";

    ModalDLC.prototype.events = function(confirmButtons, cancelButtons) {
        var i, lh, that=this;
        if(confirmButtons.length){
            for(i = 0, lh = confirmButtons.length; i < lh; i++) {
                confirmButtons[i].addEventListener("click", function(event) {
                    event.preventDefault();
                    if(that.handlers.confirm) {
                        that.handlers.obj ? that.handlers.confirm.call(that.handlers.obj) : that.handlers.confirm();
                    }
                }, false);
            }
        }
        if(cancelButtons.length) {
            for(i = 0, lh = cancelButtons.length; i < lh; i++) {
                cancelButtons[i].addEventListener("click", function(event) {
                    event.preventDefault();
                    if(that.handlers.cancel) {
                        that.handlers.obj ? that.handlers.cancel.call(that.handlers.obj) : that.handlers.cancel();
                    }
                }, false);
            }
        }
    };

    ModalDLC.prototype.addHandlers = function(confirm, cancel, obj) {
        this.handlers = {
            confirm: confirm,
            cancel: cancel,
            obj: obj,
        };
    };

    ModalDLC.prototype.show = function() {
        var that = this;
        $(this.modal).fadeIn(500, function() {
            that.modal.setAttribute("class", that.modalClass);
        });
    };

    ModalDLC.prototype.hide = function() {
        $(this.modal).hide();
        this.modal.setAttribute("class", this.modalClass + " " + ModalDLC.HIDE_MODAL_CLASS);
    };

    //добавляем базовый функционал
    CommentsApp.ModalDLC = ModalDLC;

}());

(function($) {

    "use strict";
    /*
     * Обязательные настройки
     * + удаление комментария:
     *       - класс блока со списком комментариев - dlc-view-comments
     *       - класс элемента, содержащего текущее количество комментариев (цифрой) - comments-count
     *       - класс элемента, содержащего сообщение об успешности или неуспешности добавления или удаления комментария - result-message
     *       - класс элемента, содержащего кнопку удаления комментария - dlc-delete-comment (можно вешать и на саму кнопку)
     * + добавление комментария:
     *       - тоже, что и при удалении + еще
     *       - класс элеемнта, в который помещается сообщение при неправильно заполненном комментарии - add-comment-error
     *       - класс самого комментария (непосредственно текста) - dlc-comment-body
     *       - класс элемента, относительно которого вставляются новые элементы - comments-anchor
     *       - класс элемента, который содержит span с указанием количества символов, которые еще можно ввести - symbols-left
     *       - также в форме должны быть указаны id пользователя (name=u) и id материала (name=m)
     * */

    //класс, реализующий возможность удаления комментариев (id - fullCommentsBlockId)
    var Comment = function(settings) {

        this.fullBlock = settings.elem;
        this.commentsBlock = this.fullBlock.getElementsByClassName(Comment.baseClasses.allCommentsBlock)[0];
        this.countCom = this.commentsBlock.getElementsByClassName(Comment.baseClasses.commentCount);
        this.resultMessage = this.commentsBlock.getElementsByClassName(Comment.baseClasses.resultMessage)[0];
        this.commentBlockClass = settings.commentBlock; //класс с блоком одного комментария
        this.handlerDelete = settings.handlerDelete ? settings.handlerDelete : Comment.HANDLER;

        //модальное окно для подтверждения удаления комментария
        this.modal = new CommentsApp.ModalDLC(this.fullBlock, settings.modalClass);
        this.modal.addHandlers(this.deleteComment, this.cancelDeletionComment, this);

        //касается удаления комментариев
        var that = this;
        this.commentsBlock.addEventListener('click', function(event)
            {
                var cs = event.target.className;
                if(cs && cs.indexOf(Comment.baseClasses.deleteCommentButton) != -1) {
                    that.confirmDeletionComment(event);
                }
            },
            false);
    };

    Comment.DEFAULT_TIME_MESSAGE = 5000;
    Comment.HANDLER = "handler/ajaxindex.php";

    /*
     * Обязательные классы
     * dlc-add-comments - класс блока добавления комментариев
     * dlc-view-comments - класс блока со списком комментариев
     * dlc-delete-comment - класс кнопки для удаления комментариев
     * comments-count - класс для элемента, где содержится цифрой количество комментариев
     * result-message - класс элемента, куда помещается сообщение об успешности или неудачи попытки удаления или добавления комментариев
     * */
    Comment.baseClasses = {
        addCommentsBlock: 'dlc-add-comments',
        allCommentsBlock: 'dlc-view-comments',
        deleteCommentButton: 'dlc-delete-comment',
        commentCount: 'comments-count',
        resultMessage: 'result-message',
    };

    //отображение сообщения при добавлении или удалении комментария
    Comment.prototype.createResultMessage = function(type, message) {
        if(this.resultMessage.innerHTML != "") {
            this.resultMessage.innerHTML = "";
            this.resultMessage.className = Comment.baseClasses.resultMessage;
            clearTimeout(this.h);
        }
        this.resultMessage.className = Comment.baseClasses.resultMessage + " " + Comment.baseClasses.resultMessage + "-" + type;
        this.resultMessage.innerHTML = "<span>" + message + "</span>";
        var that = this;
        this.h = setTimeout(function(){
                that.resultMessage.innerHTML = "";
                that.resultMessage.className = Comment.baseClasses.resultMessage;
            },
            Comment.DEFAULT_TIME_MESSAGE);
    };

    /*
     * Подтверждение удаления
     * Важный момент: обязательно нужно сохранить в this.delButton элемент кнопки
     * На его основе затем будет получен номер комментария и затем удален со страницы
     * */
    Comment.prototype.confirmDeletionComment = function(event) {
        if(event) {
            event.preventDefault();
        }
        this.delButton = event.target;
        this.modal.show();
    };

    Comment.prototype.cancelDeletionComment = function() {
        this.endLoading(this.delButton);
        this.delButton = null;
        this.modal.hide();
    };

    Comment.prototype.deleteComment = function() {
        this.beginLoading(this.delButton);
        var params = {delcomment: +this.delButton.getAttribute("data-comment")};
        var promise = $.post(this.handlerDelete, params, "json");
        promise.then(this.deleteSuccess.bind(this), this.deleteError.bind(this));
    };

    /*
     * Вызывается в случае успешного удаления
     * mainData - данные, которые приходят сервера
     * data - дополнительные данные, которые передаются через promise-объект
     * */
    Comment.prototype.deleteSuccess = function(data) {
        var deleteComment = this.delButton.parentNode,
            isComment = true;
        this.createResultMessage('success', 'Ваш комментарий успешно удален.');
        this.cancelDeletionComment();
        for(var i = 0, lh = this.countCom.length; i < lh; i++) {
            this.countCom[i].textContent = parseInt(this.countCom[i].textContent) - 1;
        }
        while(!deleteComment.className || deleteComment.className.indexOf(this.commentBlockClass) == -1) {
            deleteComment = deleteComment.parentNode;
            if(deleteComment == document.documentElement || deleteComment == null) {
                isComment = false;
                break;
            }
        }
        if(isComment) {
            deleteComment.parentNode.removeChild(deleteComment);
        }
    };

    Comment.prototype.deleteError = function() {
        this.createResultMessage('error', 'Извините, но в настоящий момент комментраий не может быть удален! Попробуйте удалить его позже.');
        this.cancelDeletionComment();
    };

    Comment.prototype.beginLoading = function(baseButton) {
        var buttonParent = baseButton.parentNode;
        buttonParent.setAttribute("style", "display:none");
        if(buttonParent.nextElementSibling) {
            buttonParent.nextElementSibling.setAttribute("style", "display:block");
        }
    };

    Comment.prototype.endLoading = function(baseButton) {
        var buttonParent = baseButton.parentNode;
        if(buttonParent.getAttribute("style")) {
            buttonParent.setAttribute("style", "");
            if(buttonParent.nextElementSibling) {
                buttonParent.nextElementSibling.setAttribute("style", "");
            }
        }
    };

    //класс, производный от Comment с дополнительной возможностью добавления комментариев
    /*
     * settings:
     *   fullCommentsBlockId - полный блок комментария (в примере dlcComments)
     *   newCommentClass - класс для нового комментария (по умолчанию - new-comment)
     *   commentBlock - класс блока с одним комментарием (в примере comment)
     *   modalClass - класс блока модального окна (в примере dlc-modal)
     *   handlerDelete - путь к обработчику удаления комментариев (по умолчанию handler/ajaxindex.php)
     *   handlerAdd - путь к обработчику добавления комментариев (по умолчанию handler/ajaxindex.php)
     * */
    var FullComment = function(settings) {

        Comment.call(this, settings);

        this.addCommentBlock = this.fullBlock.getElementsByClassName(Comment.baseClasses.addCommentsBlock)[0];
        this.addButton = this.addCommentBlock.querySelector('form button[type="submit"]');
        this.newComment = this.addCommentBlock.querySelector('form textarea');
        this.countSymbols = this.addCommentBlock.querySelector('.' + FullComment.COMMENT_SYMBOLS_LEFT + ' > span');
        this.addErrorPlace = this.addCommentBlock.getElementsByClassName(FullComment.DEFAULT_ERROR_MESSAGE_PLACE_CLASS)[0];

        this.material = this.addCommentBlock.querySelector('form input[name="m"]').value;
        this.user = this.addCommentBlock.querySelector('form input[name="u"]').value;
        this.handlerAdd = settings.handlerAdd ? settings.handlerAdd : Comment.HANDLER;

        /*
         * this.anchor - элемент, относительно (после) которого будут вставляться комментарии
         * */
        this.anchor = this.fullBlock.getElementsByClassName(FullComment.COMMENT_ANCHOR)[0];
        this.newCommentClass = settings.newCommentClass ? settings.newCommentClass : FullComment.DEFAULT_NEW_COMMENT_CLASS;

        this.maxCountSymbols = +this.countSymbols.textContent;

        //события
        var that = this;
        this.addButton.addEventListener('click', function(event) { that.addComment(event); }, false);
        this.newComment.addEventListener('blur', function() { that.checkComment(); }, false);
        this.newComment.addEventListener('keyup', function() { that.checkMaxLengthComment(); }, false);

    };

    FullComment.prototype = Object.create(Comment.prototype);
    FullComment.prototype.constructor = FullComment;

    FullComment.DEFAULT_NEW_COMMENT_CLASS = "new-comment";
    FullComment.DEFAULT_ERROR_MESSAGE_PLACE_CLASS = "add-comment-error";
    FullComment.COMMENT_TEXT_CLASS = "dlc-comment-body";
    FullComment.COMMENT_ANCHOR = "comments-anchor";
    FullComment.COMMENT_SYMBOLS_LEFT = "symbols-left";

    FullComment.prototype.checkMaxLengthComment = function() {
        var comment = this.newComment.value.trim(),
            commentLength = comment.length;
        this.countSymbols.textContent = this.maxCountSymbols - commentLength;
        if(commentLength > this.maxCountSymbols && !this.mistake) {
            this.addErrorPlace.textContent = 'Вы превысили максимально допустимое количество символов в комментарии.';
            this.mistake = true;
        }
        else if(this.mistake) {
            this.addErrorPlace.textContent = "";
            this.mistake = false;
        }
    };

    /*
     * Проверяет комментарий, когда textarea с комментарием выйдет из фокуса, а также
     *   когда идет отправка комментария
     * минимальная длина комментария - 3 символа (и он не должен состоять только из цифр)
     * */
    FullComment.prototype.checkComment = function() {
        var comment = this.newComment.value.trim(),
            commentLength = comment.length;
        if(commentLength > 2 && commentLength <= this.maxCountSymbols && comment != parseFloat(comment)) {
            if(this.mistake) {
                this.mistake = false;
                this.addErrorPlace.textContent = "";
            }
            return comment;
        }
        this.addErrorPlace.textContent = 'Вы указали не правильное значение в Вашем комментарии. Комментарий не может быть короче 3-ех символов или состоять только из цифр';
        this.mistake = true;
        return false;
    };

    FullComment.prototype.addComment = function(event) {
        if(event) {
            event.preventDefault();
        }
        var comment = this.checkComment();
        if(comment) {
            this.beginLoading(this.addButton);
            var params = {comment: +comment, news: +this.material, user: +this.user};
            var promise = $.post(this.handlerAdd, params, "json");
            promise.then(this.addSuccess.bind(this), this.addError.bind(this));
        }
    };

    FullComment.prototype.addSuccess = function(data) {
        this.createResultMessage('success', 'Комментарий успешно добавлен!');
        this.endLoading(this.addButton);
        var thisDate = new Date(),
            thisDay = thisDate.toLocaleDateString(),
            thisTime = thisDate.toLocaleTimeString();
        var newCom = document.createElement('div');
        newCom.className = this.newCommentClass + " " + this.commentBlockClass;
        newCom.innerHTML = '<p>Ваш новый комментарий <b>'+thisDay+' в '+thisTime+'</b>:</p><p class="' + FullComment.COMMENT_TEXT_CLASS + '">' + this.newComment.value + '</p>';
        this.anchor.nextElementSibling ? this.commentsBlock.insertBefore(newCom, this.anchor.nextElementSibling) : this.commentsBlock.appendChild(newCom);
        for(var i = 0, lh = this.countCom.length; i < lh; i++) {
            this.countCom[i].textContent = parseInt(this.countCom[i].textContent) + 1;
        }
        this.newComment.value = "";
        this.countSymbols.textContent = this.maxCountSymbols;
    };

    FullComment.prototype.addError = function() {
        this.createResultMessage('error', 'Извините, но в настоящий момент комментраий не может быть добавлен! Попробуйте добавить позже.');
        this.endLoading(this.addButton);
    };

    $.fn.DLCComment = function(options) {
        this.each(function() {
            options.elem = this;
            var comment = new Comment(options);
        });
    };

    $.fn.DLCFullComment = function(options) {
        this.each(function() {
            options.elem = this;
            var comment = new FullComment(options);
        });
    };

}(jQuery));

jQuery(document).ready(goComment);

function goComment() {

    "use strict";

    var mycomm = new jQuery("#dlcComments").DLCFullComment({
        commentBlock: 'comment',
        modalClass: "dlc-modal",
    });

}