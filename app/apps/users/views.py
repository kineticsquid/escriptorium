from os import listdir, stat
from os.path import isfile, join, relpath
from django.shortcuts import reverse
from django.conf import settings
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.messages.views import SuccessMessageMixin
from django.core.paginator import Paginator
from django.http import Http404
from django.utils.functional import cached_property
from django.utils.translation import gettext as _
from django.views.generic import CreateView, UpdateView, DetailView

from rest_framework.authtoken.models import Token
from django.contrib.auth.models import Group, Permission
from users.models import User, Invitation, ContactUs, Team
from users.forms import InvitationForm, InvitationAcceptForm, ProfileForm, ContactUsForm, GroupForm, InvitationTeamForm, RemoveUser


class SendInvitation(LoginRequiredMixin, SuccessMessageMixin, CreateView):
    """
    Note: Email is sent on instance save()
    """
    model = Invitation
    template_name = 'users/invitation_form.html'
    form_class = InvitationForm
    success_url = '/'
    success_message = _("Invitation sent successfully!")

    def get_form(self):
        form_class = self.get_form_class()
        return form_class(request=self.request, **self.get_form_kwargs())


class AcceptInvitation(CreateView):
    model = User
    template_name = 'users/invitation_accept_register.html'
    form_class = InvitationAcceptForm
    success_url = '/login/'
    success_message = _("Successfully registered, you can now log in!")

    @cached_property
    def invitation(self):
        try:
            return (Invitation.objects
                    .filter(workflow_state__lte=Invitation.STATE_RECEIVED)
                    .get(token=self.kwargs['token']))
        except Invitation.DoesNotExist:
            raise Http404("No Invitation matches the given query.")

    def get_context_data(self, **kwargs):
        context = super().get_context_data()
        context['invitation'] = self.invitation
        return context

    def get_form(self):
        form = super().get_form()
        form.initial = {
            'email': self.invitation.recipient_email,
            'first_name': self.invitation.recipient_first_name,
            'last_name': self.invitation.recipient_last_name,
        }
        return form

    def get(self, *args, **kwargs):
        if self.invitation.workflow_state < Invitation.STATE_RECEIVED:
            self.invitation.workflow_state = Invitation.STATE_RECEIVED
            self.invitation.save()
        return super().get(*args, **kwargs)

    def form_valid(self, form):
        response = super().form_valid(form)
        self.invitation.accept(form.instance)
        # TODO: send a welcome message ?!
        return response


class CreateGroup(LoginRequiredMixin, SuccessMessageMixin, CreateView):
    model = Group
    success_message = _('Team successfully created.')
    success_url = '/profile/'
    form_class = GroupForm

    def form_valid(self, form):

        response = super().form_valid(form)
        form.instance.user_set.add(self.request.user)
        group_permissions = Permission.objects.filter(content_type__app_label="users")
        form.instance.permissions.add(group_permissions)
        return super().form_valid(form)

class TeamMixen():

    def get_success_url(self):
        return reverse('team-invite', kwargs={'pk': self.object.pk})

    def get_context_data(self, **kwargs):
        context = super().get_context_data()
        context['my_teams'] = self.request.user.teams.all
        return context


class InviteToTeam(TeamMixen, LoginRequiredMixin,SuccessMessageMixin, UpdateView):
    model = Team
    success_message = _('User added successfully to the team.')

    form_class = InvitationTeamForm


    def form_valid(self, form):
        try:
            user = User.objects.get(email=form.cleaned_data['email'])
            self.object.add_user(user)

        except User.DoesNotExist:
            print('no user with this email')

        return super().form_valid(form)


class RemoveFromTeam(TeamMixen,LoginRequiredMixin,SuccessMessageMixin, UpdateView):
    model = Team
    success_message = _('User removed successfully from the team.')
    form_class = RemoveUser

    def form_valid(self, form):
        try:
            user = User.objects.get(email=form.cleaned_data['email'])
            self.object.remove_user(user)

        except User.DoesNotExist:
            print('no user with this email')

        return super().form_valid(form)



class Profile(SuccessMessageMixin, UpdateView):
    model = User
    form_class = ProfileForm
    success_url = '/profile/'
    success_message = _('Profile successfully saved.')
    template_name = 'users/profile.html'

    def get_object(self):
        return self.request.user

    def get_context_data(self):
        context = super().get_context_data()
        context['api_auth_token'], created = Token.objects.get_or_create(user=self.object)
        context['team_form'] = GroupForm()

        # files directory
        upath = self.object.get_document_store_path() + '/'
        files = listdir(upath)
        files.sort(key=lambda x: stat(join(upath, x)).st_mtime)
        files.reverse()
        files = [(relpath(join(upath, f), settings.MEDIA_ROOT), f)
                 for f in files
                 if isfile(join(upath, f))]
        paginator = Paginator(files, 25)  # Show 25 files per page.
        page_number = self.request.GET.get('page')
        context['is_paginated'] = paginator.count != 0
        context['page_obj'] = paginator.get_page(page_number)
        return context

class ContactUsView(SuccessMessageMixin, CreateView):

    model = ContactUs
    form_class = ContactUsForm

    success_message = _('Your message successfully sent.')

    template_name = 'users/contactus.html'

    success_url = '/contact/'
